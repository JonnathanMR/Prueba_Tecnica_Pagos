export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN'

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCardNumber(value: string): string {
  return digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function detectCardBrand(cardNumber: string): CardBrand {
  const digits = digitsOnly(cardNumber)
  if (/^4/.test(digits)) return 'VISA'
  if (/^5[1-5]/.test(digits)) return 'MASTERCARD'

  const sixDigitPrefix = Number(digits.slice(0, 6))
  if (digits.length >= 6 && sixDigitPrefix >= 222100 && sixDigitPrefix <= 272099) {
    return 'MASTERCARD'
  }

  return 'UNKNOWN'
}

export function isValidLuhn(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber)
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let shouldDouble = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export function isValidExpiry(value: string, now = new Date()): boolean {
  if (!/^\d{2}\/\d{2}$/.test(value)) return false
  const [monthText, yearText] = value.split('/')
  const month = Number(monthText)
  const year = 2000 + Number(yearText)
  if (month < 1 || month > 12) return false

  const lastValidDay = new Date(year, month, 0)
  return lastValidDay >= new Date(now.getFullYear(), now.getMonth(), 1)
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}
