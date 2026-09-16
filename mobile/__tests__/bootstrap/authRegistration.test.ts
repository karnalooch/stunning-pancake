import { buildRegistrationPayload } from '../../src/bootstrap/authRegistration';

describe('buildRegistrationPayload', () => {
  it('does not assign a city tenant before onboarding', () => {
    const payload = buildRegistrationPayload('adam', 'adam@example.com', 'password123');

    expect(payload).toEqual({
      username: 'adam',
      email: 'adam@example.com',
      password: 'password123',
    });
    expect(payload).not.toHaveProperty('tenant_id');
  });
});
