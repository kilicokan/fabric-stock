import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Success() {
  const router = useRouter();

  useEffect(() => {
    // 3 saniye sonra ana sayfaya yönlendir
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>✅</div>
        <h1 style={styles.title}>Başarılı!</h1>
        <p style={styles.message}>
          Kumaş çıkışı başarıyla kaydedildi.
        </p>
        <p style={styles.subMessage}>
          Ana sayfaya yönlendiriliyorsunuz...
        </p>
        <div style={styles.actions}>
          <button 
            onClick={() => router.push('/')}
            style={styles.button}
          >
            Ana Sayfaya Dön
          </button>
          <button 
            onClick={() => router.push('/fabric-exit')}
            style={styles.secondaryButton}
          >
            Yeni Kayıt Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: '2rem'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '3rem',
    textAlign: 'center' as const,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%'
  },
  icon: {
    fontSize: '4rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '2rem',
    color: '#2c3e50',
    marginBottom: '1rem',
    fontWeight: 'bold'
  },
  message: {
    fontSize: '1.1rem',
    color: '#28a745',
    marginBottom: '0.5rem'
  },
  subMessage: {
    fontSize: '0.9rem',
    color: '#6c757d',
    marginBottom: '2rem'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap' as const
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  }
};
