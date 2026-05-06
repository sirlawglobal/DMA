import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      
      <div className="w-20 h-20 mb-6 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shadow-lg mx-auto"
        style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 0 30px var(--accent-glow)' }}>
        📦
      </div>
      
      <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
        Welcome to Mide Logistic
      </h1>
      
      <p className="text-lg md:text-xl max-w-lg mb-10" style={{ color: 'var(--text-secondary)' }}>
        The central management system for logistics operations, batch tracking, and real-time delivery status updates.
      </p>
      
      <Link href="/login" 
        className="px-8 py-3.5 rounded-xl font-bold text-white hover:opacity-90 active:scale-95 transition-all shadow-lg"
        style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 0 20px var(--accent-glow)' }}>
        Admin Portal Login
      </Link>

    </div>
  );
}
