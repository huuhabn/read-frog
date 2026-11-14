export type PiiType = "PHONE" | "STK" | "CCCD" | "EMAIL"

export interface PiiPattern {
  type: PiiType
  regex: RegExp
  /** Optional validator function for extra precision (e.g. checksum or context check) */
  validate?: (match: string) => boolean
}

// Phone number: VN format 10 digits starting with 0[3|5|7|8|9] or +84[3|5|7|8|9]
// Allows optional spaces, dots, or dashes between digit clusters (e.g., 0912.345.678)
export const PHONE_REGEX =
  /(?:(?:\+84|84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[\s.-]?\d{3}[\s.-]?\d{3,4})\b/g

// CCCD / CMND: 12 digits (CCCD) or 9 digits (old CMND)
export const CCCD_REGEX = /\b(?:\d{12}|\d{9})\b/g

// Email pattern
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

// Bank Account (STK): 9 to 19 digits.
// Often preceded by STK / TK / ngân hàng / VCB / ACB / MB / etc.
export const STK_WITH_PREFIX_REGEX =
  /(?:stk|tk|số\s*tk|số\s*tài\s*khoản|tài\s*khoản|account)[\s:.-]*([0-9]{8,19})\b/gi

// Standalone bank account digits (9 to 19 digits)
export const STK_STANDALONE_REGEX = /\b\d{9,19}\b/g
