import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

import { authEmailFromCedula } from '@/lib/authIdentity'
import { supabase } from '@/lib/supabaseClient'

type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

type SessionState = {
  error: string | null
  session: Session | null
  status: SessionStatus
  user: User | null
  initialize: () => () => void
  signInWithCedula: (cedula: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

function sessionStateFromSession(session: Session | null) {
  return {
    error: null,
    session,
    status: session ? 'authenticated' : 'anonymous',
    user: session?.user ?? null,
  } satisfies Partial<SessionState>
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('invalid login') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Cedula o contrasena incorrecta.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'El usuario todavia no esta confirmado.'
  }

  return message || 'No se pudo ingresar al panel.'
}

export const useSessionStore = create<SessionState>((set) => ({
  error: null,
  session: null,
  status: 'loading',
  user: null,
  initialize: () => {
    if (!supabase) {
      set({
        error: 'Servicio no disponible.',
        session: null,
        status: 'error',
        user: null,
      })

      return () => undefined
    }

    set({ status: 'loading' })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        set({
          error: getFriendlyAuthError(error.message),
          session: null,
          status: 'error',
          user: null,
        })
        return
      }

      set(sessionStateFromSession(data.session))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set(sessionStateFromSession(session))
    })

    return () => subscription.unsubscribe()
  },
  signInWithCedula: async (cedula, password) => {
    if (!supabase) {
      throw new Error('Servicio no disponible.')
    }

    const email = authEmailFromCedula(cedula)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const message = getFriendlyAuthError(error.message)
      set({ error: message, status: 'anonymous' })
      throw new Error(message)
    }

    set(sessionStateFromSession(data.session))
  },
  signOut: async () => {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
    set({
      error: null,
      session: null,
      status: 'anonymous',
      user: null,
    })
  },
}))
