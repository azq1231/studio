'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

/**
 * Interface for the return value of the useUser hook.
 */
export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * React hook to get the current authenticated user from Firebase.
 *
 * @returns {UserHookResult} An object containing the user, loading state, and error.
 */
export function useUser(): UserHookResult {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) {
      setIsUserLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setIsUserLoading(false);
        setUserError(null);
      },
      (error) => {
        console.error("Error in onAuthStateChanged: ", error);
        setUserError(error);
        setUser(null);
        setIsUserLoading(false);
      }
    );
    
    return () => unsubscribe();
      
  }, [auth]);

  return { user, isUserLoading, userError };
}
