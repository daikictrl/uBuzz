export function isValidMatricule(value: string): { valid: boolean; error: string } {
  const normalizedValue = value.trim().toUpperCase();
  const matriculeRegex = /^IU[0-9]{4,6}$/;
  
  if (!matriculeRegex.test(normalizedValue)) {
    return {
      valid: false,
      error: "Invalid matricule. Must start with 'IU' followed by 4 to 6 digits (e.g. IU2024)."
    };
  }
  
  return { valid: true, error: "" };
}

export function isValidEmail(value: string): { valid: boolean; error: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(value.trim())) {
    return {
      valid: false,
      error: "Please enter a valid email address."
    };
  }
  
  return { valid: true, error: "" };
}

export function isValidUsername(value: string): { valid: boolean; error: string } {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  
  if (!usernameRegex.test(value.trim())) {
    return {
      valid: false,
      error: "Username must be 3–20 characters: letters, numbers, and underscores only."
    };
  }
  
  return { valid: true, error: "" };
}

export function sanitizeText(text: string, maxLength: number): string {
  if (!text) return '';
  // Strip HTML tags using regex
  const clean = text.replace(/<\/?[^>]+(>|$)/g, '');
  // Enforce max length
  return clean.slice(0, maxLength);
}
