import clsx from 'clsx'
import React from 'react'

export default function FormWrapper({
  children,
  heading,
  description,
}: FormWrapperProps) {
  return (
    <section
      className={clsx(
        'flex h-full w-full flex-col',
        'px-6 pb-8 pt-7 lg:px-[100px] lg:pb-4 lg:pt-12',
        'rounded-lg bg-white shadow-lg lg:rounded-none lg:bg-transparent lg:shadow-none'
      )}
    >
      <h1 className="text-marine-blue text-2xl font-bold lg:text-[34px]">
        {heading}
      </h1>
      <p className="text-cool-gray mt-1">{description}</p>
      {children}
    </section>
  )
}

interface FormWrapperProps {
  children: React.ReactNode
  heading: string
  description: string
}
