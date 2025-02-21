'use client'

// Components
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import useAppFormContext from '@/lib/hooks/useAppFormContext'

export default function Step({ step, segment }: StepProps) {
  // const router = useRouter();

  // const { formState } = useAppFormContext();
  // const { isValid } = formState;

  // const validateStep = async (href: string) => {
  //   if (isValid) {
  //     router.push(href);
  //   }
  // };

  return (
    <Link href={`/${step.segment}`}>
      {/* <button type="button" onClick={() => validateStep(`/${step}`)}> */}
      <div className="flex items-center gap-4">
        <button
          className={clsx(
            'h-[33px] w-[33px] rounded-full border',
            'transition-colors duration-300',
            step.segment === segment
              ? 'bg-light-blue text-marine-blue border-transparent'
              : 'border-white bg-transparent text-white',
            'text-sm font-bold'
          )}
        >
          {step.number}
        </button>
        <div className="hidden flex-col uppercase lg:flex">
          <h3 className={clsx('text-cool-gray text-[13px] font-normal')}>
            Step {step.number}
          </h3>
          <h2
            className={clsx(
              'text-[14px] font-bold tracking-[0.1em] text-white'
            )}
          >
            {step.heading}
          </h2>
        </div>
      </div>
      {/* </button> */}
    </Link>
  )
}

interface StepProps {
  step: {
    number: number
    segment: 'info' | 'plan' | 'addons' | 'summary'
    heading: string
  }
  segment: 'info' | 'plan' | 'addons' | 'summary'
}
