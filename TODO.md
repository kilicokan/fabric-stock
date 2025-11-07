# TODO: Add Splash Screen to Login Pages and Hide Sidebar

## Tasks
- [x] Update splash-screen.tsx: Change background to white to match sidebar, adjust text and elements for visibility on white background.
- [x] Update pages/admin/login.tsx: Import SplashScreen, add showSplash state (initially true), render SplashScreen conditionally with onHide. On login success, set showSplash true and redirect after 3.5s.
- [x] Update pages/login.tsx: Import SplashScreen, add showSplash state (initially true), render SplashScreen conditionally with onHide. On login success, set showSplash true and redirect after 3.5s. Change background to white.
- [x] Update pages/_app.tsx: Add /admin/login to public paths and prevent sidebar from showing on login pages.
- [x] Test the changes: Run the app, check splash on page load and after login for both login pages, and ensure sidebar is hidden.
