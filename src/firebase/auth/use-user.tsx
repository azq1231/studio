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
    // If there's no auth instance, we can't get a user.
    if (!auth) {
      setIsUserLoading(false);
      // Optional: Set an error if you expect auth to always be available.
      // setError(new Error("Firebase Auth instance not available."));
      return;
    }

    // Set loading to true when starting to check for a user.
    setIsUserLoading(true);

    // Subscribe to Firebase's auth state changes.
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // When the auth state is resolved, update the user state.
        setUser(firebaseUser);
        // We're no longer loading.
        setIsUserLoading(false);
        // Clear any previous errors.
        setUserError(null);
      },
      (error) => {
        // Handle any errors that occur during auth state observation.
        console.error("Error in onAuthStateChanged: ", error);
        setUserError(error);
        setUser(null);
        setIsUserLoading(false);
      }
    );

    // Cleanup the subscription when the component unmounts.
    return () => unsubscribe();
  }, [auth]); // Rerun the effect if the auth instance changes.

  return { user, isUserLoading, userError };
}
