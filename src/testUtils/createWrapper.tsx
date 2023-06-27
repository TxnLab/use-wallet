// See https://testing-library.com/docs/react-testing-library/api#renderhook-options

import React, { ComponentType, ReactNode } from 'react'

interface CreatedWrapperProps {
  children: ReactNode
}

export function createWrapper<P>(
  Wrapper: ComponentType<P>,
  props: P
): React.FC<CreatedWrapperProps> {
  return function CreatedWrapper({ children }: CreatedWrapperProps) {
    return <Wrapper {...props}>{children}</Wrapper>
  }
}
