'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
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
 * Handles both initial state check and redirect results.
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

    // First, check for redirect result
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // User is signed in. The onAuthStateChanged observer will handle setting the user.
        }
      })
      .catch((error) => {
        // Handle Errors here.
        console.error("Error from getRedirectResult: ", error);
        setUserError(error);
      })
      .finally(() => {
         // This is the primary listener for auth state changes.
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
        // Return the unsubscribe function for cleanup.
        return () => unsubscribe();
      });
      
  }, [auth]); // Rerun the effect if the auth instance changes.

  return { user, isUserLoading, userError };
}
