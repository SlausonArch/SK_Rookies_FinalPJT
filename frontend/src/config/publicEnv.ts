const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required. Configure it in your frontend env file or container environment.`,
    );
  }

  return value;
};

export const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE ?? 'exchange';
export const API_BASE_URL = getRequiredEnv('NEXT_PUBLIC_API_BASE_URL');

export const getExchangeFrontendUrl = (): string =>
  getRequiredEnv('NEXT_PUBLIC_EXCHANGE_FRONTEND_URL');

export const getBankFrontendUrl = (): string =>
  getRequiredEnv('NEXT_PUBLIC_BANK_FRONTEND_URL');
