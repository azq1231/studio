import { FinanceFlowClient } from '@/components/finance-flow-client';
import { Banknote } from 'lucide-react';
import { AuthButton } from '@/components/auth-button';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-6 md:p-8" suppressHydrationWarning>
      <div className="w-full max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="bg-primary text-primary-foreground p-2.5 sm:p-3 rounded-xl shadow-md shrink-0">
              <Banknote className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-headline leading-tight">FinanceFlow</h1>
              <p className="mt-1 max-w-[28rem] text-sm sm:text-base leading-6 text-muted-foreground">
                您的智慧銀行報表整理工具 v1.1
              </p>
            </div>
          </div>
          <div className="self-start sm:self-auto">
            <AuthButton />
          </div>
        </header>
        <main>
          <FinanceFlowClient />
        </main>
      </div>
    </div>
  );
}
