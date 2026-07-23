import { afterEach, describe, expect, it, vi } from 'vitest';

const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signUp: signUpMock },
  }),
}));

import { signUp } from './auth';

afterEach(() => {
  signUpMock.mockReset();
  vi.unstubAllGlobals();
});

describe('signUp', () => {
  it('routes PKCE email confirmation through the server callback and preserves a safe next path', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://msm.example' } });
    signUpMock.mockResolvedValue({ data: {}, error: null });

    await signUp('parent@example.com', 'secret-password', '  Parent Name  ', '/booking?tutor=mateo');

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'secret-password',
      options: {
        data: { name: 'Parent Name' },
        emailRedirectTo:
          'https://msm.example/auth/callback?next=%2Fbooking%3Ftutor%3Dmateo',
      },
    });
  });

  it('does not place an external redirect in the confirmation URL', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://msm.example' } });
    signUpMock.mockResolvedValue({ data: {}, error: null });

    await signUp('parent@example.com', 'secret-password', 'Parent', 'https://evil.example');

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://msm.example/auth/callback?next=%2Fdashboard',
        }),
      }),
    );
  });
});
