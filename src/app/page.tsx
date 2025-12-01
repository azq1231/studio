import { FinanceFlowClient } from '@/components/finance-flow-client';
import { Banknote } from 'lucide-react';
import { AuthButton } from '@/components/auth-button';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-md">
              <Banknote className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-headline">FinanceFlow</h1>
              <p className="text-muted-foreground mt-1">您的智慧銀行報表整理工具</p>
            </div>
          </div>
          <AuthButton />
        </header>
        <main>
          <FinanceFlowClient />
        </main>
      </div>
    </div>
  );
}
