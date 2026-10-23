#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      } else {
        start_next_server(app)?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building Tauri application");

  app.run(|handle, event| {
    if matches!(event, tauri::RunEvent::Exit) {
      if let Some(server) = handle.try_state::<NextServer>() {
        match server.0.lock() {
          Ok(mut child) => {
            if let Err(error) = child.kill() {
              log::error!("Could not stop the Next.js server: {error}");
            }
            if let Err(error) = child.wait() {
              log::error!("Could not wait for the Next.js server to exit: {error}");
            }
          }
          Err(error) => log::error!("Next.js server state was poisoned: {error}"),
        }
      }
    }
  });
}

use std::{
  fs::{self, File},
  net::{Ipv4Addr, TcpListener, TcpStream},
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread,
  time::{Duration, Instant},
};
use tauri::Manager;

struct NextServer(Mutex<Child>);

fn start_next_server(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  let resources = app.path().resource_dir()?;
  let web_dir = resources.join("web");
  let node_executable = resources.join("node.exe");
  let server_script = web_dir.join("server.js");
  let env_loader = web_dir.join("tauri-env.cjs");
  if !node_executable.is_file() || !server_script.is_file() || !env_loader.is_file() {
    return Err(format!(
      "Packaged Next.js runtime is incomplete in {}.",
      resources.display()
    )
    .into());
  }

  let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
  let port = listener.local_addr()?.port();
  drop(listener);

  let log_dir = app.path().app_log_dir()?;
  fs::create_dir_all(&log_dir)?;
  let log_path = log_dir.join("next-server.log");
  let config_dir = app.path().app_config_dir()?;
  fs::create_dir_all(&config_dir)?;
  let env_file = config_dir.join(".env");
  let stdout = File::create(&log_path)?;
  let stderr = stdout.try_clone()?;
  let mut child = Command::new(node_executable)
    .arg("--require")
    .arg(env_loader)
    .arg(server_script)
    .current_dir(web_dir)
    .env("HOSTNAME", "127.0.0.1")
    .env("PORT", port.to_string())
    .env("NODE_ENV", "production")
    .env("MIRAAPP_ENV_FILE", env_file)
    .stdout(Stdio::from(stdout))
    .stderr(Stdio::from(stderr))
    .spawn()?;

  let deadline = Instant::now() + Duration::from_secs(60);
  loop {
    if TcpStream::connect((Ipv4Addr::LOCALHOST, port)).is_ok() {
      break;
    }
    if let Some(status) = child.try_wait()? {
      return Err(format!(
        "The Next.js server exited with {status}. See {} for details.",
        log_path.display()
      )
      .into());
    }
    if Instant::now() >= deadline {
      child.kill()?;
      child.wait()?;
      return Err(format!(
        "The Next.js server did not start within 60 seconds. See {} for details.",
        log_path.display()
      )
      .into());
    }
    thread::sleep(Duration::from_millis(200));
  }

  app.manage(NextServer(Mutex::new(child)));
  if let Some(window) = app.get_webview_window("main") {
    window.eval(&format!(
      "window.location.replace('http://127.0.0.1:{port}')"
    ))?;
  } else {
    return Err("The main application window was not found.".into());
  }
  Ok(())
}
