import { useFormContext } from 'react-hook-form'

// Types
import type { FormValues } from '../form'

export default function useAppFormContext() {
  return useFormContext<FormValues>()
}
