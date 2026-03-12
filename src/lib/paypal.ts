export const PAYPAL_BUSINESS_EMAIL = 'asher205@gmail.com';

type PayPalCurrency = 'ILS' | 'USD' | 'EUR';

interface CreatePayPalCheckoutUrlOptions {
  itemName: string;
  amount?: number;
  currency?: PayPalCurrency;
  customId?: string;
  returnUrl?: string;
  cancelReturnUrl?: string;
}

export function createPayPalCheckoutUrl({
  itemName,
  amount,
  currency = 'ILS',
  customId,
  returnUrl,
  cancelReturnUrl,
}: CreatePayPalCheckoutUrlOptions): string {
  const params = new URLSearchParams({
    cmd: '_xclick',
    business: PAYPAL_BUSINESS_EMAIL,
    item_name: itemName,
    currency_code: currency,
    no_note: '1',
  });

  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    params.set('amount', amount.toFixed(2));
  }

  if (customId) {
    params.set('custom', customId);
  }

  if (returnUrl) {
    params.set('return', returnUrl);
  }

  if (cancelReturnUrl) {
    params.set('cancel_return', cancelReturnUrl);
  }

  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}
