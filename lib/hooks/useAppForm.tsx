import type { DefaultValues} from 'react-hook-form';
import { useForm } from 'react-hook-form'

// Types
import type { FormValues } from '../form'

export default function useAppForm(defaultValues?: DefaultValues<FormValues>) {
  return useForm<FormValues>({ defaultValues })
}
