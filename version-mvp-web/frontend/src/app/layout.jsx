import './globals.css';

export const metadata = {
  title: 'Inclusive Tourism HK',
  description: 'AI-powered accessible tourism planner for Hong Kong',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="accessible">♿</span>
            <span className="font-semibold text-brand-700 text-lg">Inclusive Tourism HK</span>
            <span className="ml-auto text-xs text-gray-400">MVP Web v1</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
