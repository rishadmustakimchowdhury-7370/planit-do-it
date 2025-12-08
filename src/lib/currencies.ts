// ISO 4217 Currency List - All currencies with symbols
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const currencies: Currency[] = [
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COL$' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
  { code: 'OMR', name: 'Omani Rial', symbol: '﷼' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭' },
  { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'лв' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br' },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L' },
  { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин.' },
  { code: 'BAM', name: 'Bosnia and Herzegovina Mark', symbol: 'KM' },
];

// Get currency by code
export function getCurrency(code: string): Currency | undefined {
  return currencies.find(c => c.code === code);
}

// Format currency amount
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrency(currencyCode);
  const symbol = currency?.symbol || currencyCode;
  
  return `${symbol}${amount.toLocaleString()}`;
}

// Format salary range
export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currencyCode: string = 'USD'
): string {
  const currency = getCurrency(currencyCode);
  const symbol = currency?.symbol || currencyCode;
  
  if (!min && !max) return 'Salary TBD';
  
  if (min && max) {
    if (min >= 1000 && max >= 1000) {
      return `${symbol}${(min / 1000).toFixed(0)}k - ${symbol}${(max / 1000).toFixed(0)}k ${currencyCode}`;
    }
    return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()} ${currencyCode}`;
  }
  
  if (min) {
    return min >= 1000 
      ? `${symbol}${(min / 1000).toFixed(0)}k+ ${currencyCode}`
      : `${symbol}${min.toLocaleString()}+ ${currencyCode}`;
  }
  
  return max && max >= 1000
    ? `Up to ${symbol}${(max / 1000).toFixed(0)}k ${currencyCode}`
    : `Up to ${symbol}${max?.toLocaleString()} ${currencyCode}`;
}
