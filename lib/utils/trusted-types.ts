/**
 * Creates a Trusted Types policy if it doesn't already exist
 * @param name The name of the policy to create
 * @param policy The policy configuration object
 * @returns The created or existing policy
 */
export function createTrustedPolicy(
  name: string,
  policy: TrustedTypePolicyOptions
) {
  if (typeof window === 'undefined') return null

  // Check if Trusted Types is supported
  if (!window.trustedTypes) return null

  try {
    // For default policy, check if it already exists
    if (name === 'default' && window.trustedTypes.defaultPolicy) {
      return window.trustedTypes.defaultPolicy
    }

    // For other policies, try to get existing policy first
    try {
      const existingPolicy = window.trustedTypes.getAttributeType(name)
      if (existingPolicy) return existingPolicy
    } catch (e) {
      // Policy doesn't exist, continue to create it
    }

    // Create new policy
    return window.trustedTypes.createPolicy(name, policy)
  } catch (error) {
    console.warn(`Failed to create Trusted Types policy "${name}":`, error)
    return null
  }
}

interface TrustedTypePolicyOptions {
  createHTML?: (input: string) => string
  createScript?: (input: string) => string
  createScriptURL?: (input: string) => string
  createURL?: (input: string) => string
}
