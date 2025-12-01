'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const formSchema = z.object({
  email: z.string().email({ message: '請輸入有效的電子郵件地址。' }),
  password: z.string().min(6, { message: '密碼長度至少需要6個字元。' }),
});

type UserFormValue = z.infer<typeof formSchema>;

interface AuthFormProps {
  onAuthSuccess?: () => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const auth = useAuth();
  const { toast } = useToast();

  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: UserFormValue) => {
    setLoading(true);
    setFirebaseError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: '登入成功', description: '歡迎回來！' });
      } else {
        await createUserWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: '註冊成功', description: '您的帳號已建立。' });
      }
      onAuthSuccess?.();
    } catch (error: any) {
      console.error("Firebase auth error:", error.code);
      switch (error.code) {
        case 'auth/user-not-found':
          setFirebaseError('此電子郵件尚未註冊。');
          break;
        case 'auth/wrong-password':
          setFirebaseError('密碼錯誤，請再試一次。');
          break;
        case 'auth/email-already-in-use':
          setFirebaseError('此電子郵件已經被註冊。');
          break;
        case 'auth/invalid-email':
            setFirebaseError('電子郵件格式不正確。');
            break;
        default:
          setFirebaseError('發生未知錯誤，請稍後再試。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>電子郵件</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密碼</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="請輸入密碼"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {firebaseError && (
             <Alert variant="destructive">
               <AlertDescription>{firebaseError}</AlertDescription>
             </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? '登入' : '註冊'}
          </Button>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            或
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setIsLogin(!isLogin);
          setFirebaseError(null);
          form.reset();
        }}
        disabled={loading}
      >
        {isLogin ? '建立新帳號' : '已有帳號？ 前往登入'}
      </Button>
    </div>
  );
}
