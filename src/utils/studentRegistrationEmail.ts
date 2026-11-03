/** Validates the address only; creation permission comes from the active access list. */
export function studentRegistrationEmailAllowed(email:string):boolean{
 const normalized=email.trim().toLowerCase();
 return normalized.length<=254&&!/[\r\n\u0000-\u001f\u007f]/.test(normalized)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
