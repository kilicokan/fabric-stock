// components/Layout/Layout.tsx
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <Sidebar />
      <Header />
      <main className="ml-64 mt-16 p-6 bg-gray-100 min-h-screen">{children}</main>
    </div>
  );
};

export default Layout;
