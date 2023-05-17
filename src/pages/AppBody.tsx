import React, { PropsWithChildren } from 'react'
import styled from 'styled-components/macro'
import { Z_INDEX } from 'theme/zIndex'

/* 
1. BodyWrapper 컴포넌트를 만듭니다. 이 컴포넌트는 main 태그를 래핑합니다.
2. BodyWrapper 컴포넌트는 margin-top, max-width, width, background, border-radius, border, margin-top, margin-left, margin-right, z-index, font-feature-settings 속성을 가집니다.
3. BodyWrapper 컴포넌트의 기본값을 설정합니다.
4. 컴포넌트를 만듭니다. 이 컴포넌트는 BodyWrapper 컴포넌트를 래핑합니다.
5. AppBody 컴포넌트의 props는 children, margin, maxWidth를 가집니다.
*/
interface BodyWrapperProps {
  $margin?: string
  $maxWidth?: string
}

export const BodyWrapper = styled.main<BodyWrapperProps>`
  position: relative;
  margin-top: ${({ $margin }) => $margin ?? '0px'};
  max-width: ${({ $maxWidth }) => $maxWidth ?? '420px'};
  width: 100%;
  background: ${({ theme }) => theme.backgroundSurface};
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.backgroundOutline};
  margin-top: 1rem;
  margin-left: auto;
  margin-right: auto;
  z-index: ${Z_INDEX.deprecated_content};
  font-feature-settings: 'ss01' on, 'ss02' on, 'cv01' on, 'cv03' on;
`

/**
 * The styled container element that wraps the content of most pages and the tabs.
 * 6. AppBody 컴포넌트의 기본값을 설정합니다. */
export default function AppBody(props: PropsWithChildren<BodyWrapperProps>) {
  return <BodyWrapper {...props} />
}
