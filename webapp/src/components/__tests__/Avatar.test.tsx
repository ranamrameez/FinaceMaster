import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from 'firebase/auth';
import { Avatar } from '../Avatar';

// User-reported (2026-09): "Profile Picture not coming from google, not a
// rounded circle as well." Tested directly (not through a real signed-in
// session) since exercising this live needs a real Google account this
// project's own cloud-sync-safety rules forbid creating a throwaway one
// for (see CLAUDE.md) — the priority logic (emoji > Google photo > plain
// initial) and the circular-clip CSS are both verifiable without one.
function fakeUser(overrides: Partial<User> = {}): User {
  return { displayName: null, email: null, phoneNumber: null, photoURL: null, ...overrides } as User;
}

describe('Avatar', () => {
  it('shows a custom avatarEmoji over everything else', () => {
    const user = fakeUser({ photoURL: 'https://lh3.googleusercontent.com/a/real-photo' });
    const { container } = render(<Avatar user={user} avatarEmoji="🚀" />);
    expect(container.textContent).toBe('🚀');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the real Google photo as a circular <img> when there is no custom emoji', () => {
    const user = fakeUser({ photoURL: 'https://lh3.googleusercontent.com/a/real-photo', displayName: 'Ranam' });
    const { container } = render(<Avatar user={user} size={40} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toBe('https://lh3.googleusercontent.com/a/real-photo');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img?.className).toContain('avatar-circle');
    expect(img?.style.width).toBe('40px');
    expect(img?.style.height).toBe('40px');
  });

  it('falls back to a plain text initial when there is neither an emoji nor a photo', () => {
    const user = fakeUser({ email: 'ranam@example.com' });
    const { container } = render(<Avatar user={user} />);
    expect(container.textContent).toBe('R');
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back to "?" with no user, no emoji, and no identifying info at all', () => {
    const { container } = render(<Avatar user={null} />);
    expect(container.textContent).toBe('?');
  });
});
