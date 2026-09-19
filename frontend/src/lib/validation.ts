export const PINCODE_PATTERN = "^[0-9]{6}$";
export const PINCODE_REGEX = /^\d{6}$/;

export function isValidPincode(value: string): boolean {
  return PINCODE_REGEX.test(value.trim());
}
