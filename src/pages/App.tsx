import { getDeviceId, sendAnalyticsEvent, Trace, user } from '@uniswap/analytics'
import { CustomUserProperties, getBrowser, InterfacePageName, SharedEventName } from '@uniswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import Loader from 'components/Icons/LoadingSpinner'
import TopLevelModals from 'components/TopLevelModals'
import { useFeatureFlagsIsLoaded } from 'featureFlags'
import ApeModeQueryParamReader from 'hooks/useApeModeQueryParamReader'
import { useAtom } from 'jotai'
import { useBag } from 'nft/hooks/useBag'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { shouldDisableNFTRoutesAtom } from 'state/application/atoms'
import { StatsigProvider, StatsigUser } from 'statsig-react'
import styled from 'styled-components/macro'
import { SpinnerSVG } from 'theme/components'
import { useIsDarkMode } from 'theme/components/ThemeToggle'
import { flexRowNoWrap } from 'theme/styles'
import { Z_INDEX } from 'theme/zIndex'
import { STATSIG_DUMMY_KEY } from 'tracing'
import { getEnvName } from 'utils/env'
import { getCLS, getFCP, getFID, getLCP, Metric } from 'web-vitals'

import { useAnalyticsReporter } from '../components/analytics'
import ErrorBoundary from '../components/ErrorBoundary'
import { PageTabs } from '../components/NavBar'
import NavBar from '../components/NavBar'
import Polling from '../components/Polling'
import Popups from '../components/Popups'
import { useIsExpertMode } from '../state/user/hooks'
import DarkModeQueryParamReader from '../theme/components/DarkModeQueryParamReader'
import AddLiquidity from './AddLiquidity'
import { RedirectDuplicateTokenIds } from './AddLiquidity/redirects'
import { RedirectDuplicateTokenIdsV2 } from './AddLiquidityV2/redirects'
import Landing from './Landing'
import MigrateV2 from './MigrateV2'
import MigrateV2Pair from './MigrateV2/MigrateV2Pair'
import NotFound from './NotFound'
import Pool from './Pool'
import PositionPage from './Pool/PositionPage'
import PoolV2 from './Pool/v2'
import PoolFinder from './PoolFinder'
import RemoveLiquidity from './RemoveLiquidity'
import RemoveLiquidityV3 from './RemoveLiquidity/V3'
import Swap from './Swap'
import { RedirectPathToSwapOnly } from './Swap/redirects'
import Tokens from './Tokens'

/*
1. 컴포넌트를 import하는데 lazy로 한다.
2. lazy로 import하는 이유는 해당 컴포넌트를 다른 컴포넌트와 함께 비동기적으로 로드하기 위해서이다.
3. lazy로 import하게 되면 해당 컴포넌트는 webpackChunkName으로 빌드된다.
4. webpackChunkName은 해당 컴포넌트를 빌드할 때 파일 이름을 지정하는데, 이 이름을 통해
   react-router에서 해당 컴포넌트를 찾아서 렌더링할 수 있다.
5. 만약 webpackChunkName이 없다면, react-router는 해당 컴포넌트를 찾을 수 없다.
*/
const TokenDetails = lazy(() => import('./TokenDetails'))
const Vote = lazy(() => import('./Vote'))
const NftExplore = lazy(() => import('nft/pages/explore'))
const Collection = lazy(() => import('nft/pages/collection'))
const Profile = lazy(() => import('nft/pages/profile/profile'))
const Asset = lazy(() => import('nft/pages/asset/Asset'))

/* 
1. flex-direction: column을 통해 수직 방향으로 flex item을 배치
2. min-height: 100vh를 통해 최소한 브라우저 높이만큼 화면을 차지하도록 합니다.
3. padding-top: ${({ theme }) => theme.navHeight}px;를 통해 flex item의 간격을 설정합니다.
4. flex: 1를 통해 flex item이 남은 공간을 모두 차지할 수 있도록 합니다.
 */
const BodyWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  padding: ${({ theme }) => theme.navHeight}px 0px 5rem 0px;
  align-items: center;
  flex: 1;
`
/* 
1. MobileBottomBar는 fixed로 화면 아래에 고정되어 있습니다.
2. MobileBottomBar는 우측, 좌측, 아래 0px만큼 떨어져 있습니다.
3. MobileBottomBar는 100vw만큼의 너비를 가지고 있습니다.
4. MobileBottomBar는 컨텐츠를 flex 방식으로 정렬합니다.
5. MobileBottomBar의 각 컨텐츠는 space-between 방식으로 정렬합니다.
6. MobileBottomBar의 각 컨텐츠는 4px 8px만큼의 패딩을 가지고 있습니다.
7. MobileBottomBar의 높이는 theme.mobileBottomBarHeight만큼의 높이를 가지고 있습니다.
8. MobileBottomBar의 배경색은 theme.backgroundSurface입니다.
9. MobileBottomBar의 상단은 1px만큼의 선을 가지고 있습니다.
10. MobileBottomBar의 선의 색은 theme.backgroundOutline입니다.
11. MobileBottomBar는 theme.breakpoint.md보다 큰 화면에서는 보이지 않습니다. */
const MobileBottomBar = styled.div`
  z-index: ${Z_INDEX.sticky};
  position: fixed;
  display: flex;
  bottom: 0;
  right: 0;
  left: 0;
  width: 100vw;
  justify-content: space-between;
  padding: 4px 8px;
  height: ${({ theme }) => theme.mobileBottomBarHeight}px;
  background: ${({ theme }) => theme.backgroundSurface};
  border-top: 1px solid ${({ theme }) => theme.backgroundOutline};

  @media screen and (min-width: ${({ theme }) => theme.breakpoint.md}px) {
    display: none;
  }
`

const HeaderWrapper = styled.div<{ transparent?: boolean }>`
  ${flexRowNoWrap};
  background-color: ${({ theme, transparent }) => !transparent && theme.backgroundSurface};
  border-bottom: ${({ theme, transparent }) => !transparent && `1px solid ${theme.backgroundOutline}`};
  width: 100%;
  justify-content: space-between;
  position: fixed;
  top: 0;
  z-index: ${Z_INDEX.dropdown};
`
/* 
1. locationPathname이 '/swap'로 시작하는지 확인합니다.
2. '/swap'로 시작하면, SWAP_PAGE를 반환합니다.
3. '/vote'로 시작하면, VOTE_PAGE를 반환합니다.
4. '/pools'로 시작하면, POOL_PAGE를 반환합니다.
5. '/tokens'로 시작하면, TOKENS_PAGE를 반환합니다.
6. '/nfts/profile'로 시작하면, NFT_PROFILE_PAGE를 반환합니다.
7. '/nfts/asset'로 시작하면, NFT_DETAILS_PAGE를 반환합니다.
8. '/nfts/collection'로 시작하면, NFT_COLLECTION_PAGE를 반환합니다.
9. '/nfts'로 시작하면, NFT_EXPLORE_PAGE를 반환합니다.
10. 그 외의 경우에는, undefined를 반환합니다. */
function getCurrentPageFromLocation(locationPathname: string): InterfacePageName | undefined {
  switch (true) {
    case locationPathname.startsWith('/swap'):
      return InterfacePageName.SWAP_PAGE
    case locationPathname.startsWith('/vote'):
      return InterfacePageName.VOTE_PAGE
    case locationPathname.startsWith('/pools'):
    case locationPathname.startsWith('/pool'):
      return InterfacePageName.POOL_PAGE
    case locationPathname.startsWith('/tokens'):
      return InterfacePageName.TOKENS_PAGE
    case locationPathname.startsWith('/nfts/profile'):
      return InterfacePageName.NFT_PROFILE_PAGE
    case locationPathname.startsWith('/nfts/asset'):
      return InterfacePageName.NFT_DETAILS_PAGE
    case locationPathname.startsWith('/nfts/collection'):
      return InterfacePageName.NFT_COLLECTION_PAGE
    case locationPathname.startsWith('/nfts'):
      return InterfacePageName.NFT_EXPLORE_PAGE
    default:
      return undefined
  }
}

// this is the same svg defined in assets/images/blue-loader.svg
// it is defined here because the remote asset may not have had time to load when this file is executing
/* 
1. SVG를 불러오기 위해 react-svg를 설치합니다.
2. SVG를 불러올 컴포넌트를 만듭니다.
3. SVG의 너비와 높이를 지정합니다.
4. SVG의 뷰박스를 지정합니다. (이 경우, 0, 0, 94, 94)
5. path 엘리먼트에 d 속성을 추가합니다.
6. d 속성은 path 엘리먼트의 모양을 정의합니다.
7. stroke 속성을 추가합니다.
8. stroke 속성은 path 엘리먼트의 모양의 윤곽선 색상을 정의합니다.
9. strokeWidth 속성을 추가합니다.
10. strokeWidth 속성은 path 엘리먼트의 윤곽선 두께를 정의합니다.
11. strokeLinecap 속성을 추가합니다.
12. strokeLinecap 속성은 path 엘리먼트의 윤곽선 끝 모양을 정의합니다.
13. strokeLinejoin 속성을 추가합니다.
14. strokeLinejoin 속성은 path 엘리먼트의 윤곽선 끝 모양을 정의합니다.
*/
const LazyLoadSpinner = () => (
  <SpinnerSVG width="94" height="94" viewBox="0 0 94 94" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M92 47C92 22.1472 71.8528 2 47 2C22.1472 2 2 22.1472 2 47C2 71.8528 22.1472 92 47 92"
      stroke="#2172E5"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SpinnerSVG>
)
/* 
1. useSearchParams()를 이용해 현재 url의 searchParams를 가져온다.
2. searchParams의 disableNFTs의 value가 'true'인 경우, shouldDisableNFTRoutes를 true로 설정한다.
3. searchParams의 disableNFTs의 value가 'false'인 경우, shouldDisableNFTRoutes를 false로 설정한다.
4. searchParams의 disableNFTs의 value가 'true' 또는 'false'가 아닌 경우, 아무것도 하지 않는다. */
export default function App() {
  const isLoaded = useFeatureFlagsIsLoaded()
  const [shouldDisableNFTRoutes, setShouldDisableNFTRoutes] = useAtom(shouldDisableNFTRoutesAtom)

  const { pathname } = useLocation()
  const currentPage = getCurrentPageFromLocation(pathname)
  const isDarkMode = useIsDarkMode()
  const isExpertMode = useIsExpertMode()
  const [scrolledState, setScrolledState] = useState(false)

  useAnalyticsReporter()

  useEffect(() => {
    window.scrollTo(0, 0)
    setScrolledState(false)
  }, [pathname])

  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('disableNFTs') === 'true') {
      setShouldDisableNFTRoutes(true)
    } else if (searchParams.get('disableNFTs') === 'false') {
      setShouldDisableNFTRoutes(false)
    }
  }, [searchParams, setShouldDisableNFTRoutes])

  /* 
  1. StatsigUser는 Statsig SDK에 필요한 필수 정보를 담은 객체입니다.
  2. getDeviceId()는 사용자의 브라우저에 저장된 statsig_deviceID를 반환합니다. 만약 statsig_deviceID가 없다면 새로운 ID를 생성하고 저장합니다.
  3. customIDs는 Statsig SDK의 customID 기능을 사용하기 위한 필드입니다. Statsig SDK는 customID를 사용하여 사용자에게 특정 기능을 제공하고 통계를 내는데 사용합니다.
  4. customID를 사용하기 위해서는 Statsig SDK의 customID 기능을 활성화해야 합니다. 설정은 Statsig Console에서 프로젝트를 생성한 후, 프로젝트의 설정 페이지에서 하실 수 있습니다.
  5. customID는 사용자의 브라우저에 저장되지 않습니다. 따라서 customID를 사용하여 통계를 내기 위해서는 사용자가 매번 새로운 customID를 생성하지 않도록 서버에서 customID를 설정해주어야 합니다.
  6. customID를 설정하는 방법은 Custom ID를 설정하는 부분을 참고해주시기 바랍니다. */

  useEffect(() => {
    // User properties *must* be set before sending corresponding event properties,
    // so that the event contains the correct and up-to-date user properties.
    user.set(CustomUserProperties.USER_AGENT, navigator.userAgent)
    user.set(CustomUserProperties.BROWSER, getBrowser())
    user.set(CustomUserProperties.SCREEN_RESOLUTION_HEIGHT, window.screen.height)
    user.set(CustomUserProperties.SCREEN_RESOLUTION_WIDTH, window.screen.width)

    sendAnalyticsEvent(SharedEventName.APP_LOADED)
    getCLS(({ delta }: Metric) => sendAnalyticsEvent(SharedEventName.WEB_VITALS, { cumulative_layout_shift: delta }))
    getFCP(({ delta }: Metric) => sendAnalyticsEvent(SharedEventName.WEB_VITALS, { first_contentful_paint_ms: delta }))
    getFID(({ delta }: Metric) => sendAnalyticsEvent(SharedEventName.WEB_VITALS, { first_input_delay_ms: delta }))
    getLCP(({ delta }: Metric) =>
      sendAnalyticsEvent(SharedEventName.WEB_VITALS, { largest_contentful_paint_ms: delta })
    )
  }, [])

  useEffect(() => {
    user.set(CustomUserProperties.DARK_MODE, isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    user.set(CustomUserProperties.EXPERT_MODE, isExpertMode)
  }, [isExpertMode])

  useEffect(() => {
    const scrollListener = () => {
      setScrolledState(window.scrollY > 0)
    }
    window.addEventListener('scroll', scrollListener)
    return () => window.removeEventListener('scroll', scrollListener)
  }, [])

  const isBagExpanded = useBag((state) => state.bagExpanded)
  const isHeaderTransparent = !scrolledState && !isBagExpanded

  const { account } = useWeb3React()
  const statsigUser: StatsigUser = useMemo(
    () => ({
      userID: getDeviceId(),
      customIDs: { address: account ?? '' },
    }),
    [account]
  )

  /*
  1. ErrorBoundary를 통해 오류를 처리합니다.
  2. DarkModeQueryParamReader를 통해 URL을 통해 들어온 사용자 설정 유지를 확인합니다.
  3. StatsigProvider를 통해 statsigUser를 초기화합니다.
  4. NavBar를 통해 상단바를 구성합니다.
  5. Popups를 통해 모달창을 구성합니다.
  6. Polling을 통해 주기적으로 데이터를 업데이트합니다.
  7. TopLevelModals를 통해 최상위 모달창을 구성합니다.
  8. Route를 통해 페이지를 구성합니다.
  9. PageTabs를 통해 하단바를 구성합니다. */
  return (
    <ErrorBoundary>
      <DarkModeQueryParamReader />
      <ApeModeQueryParamReader />
      <Trace page={currentPage}>
        <StatsigProvider
          user={statsigUser}
          // TODO: replace with proxy and cycle key
          sdkKey={STATSIG_DUMMY_KEY}
          waitForInitialization={false}
          options={{
            environment: { tier: getEnvName() },
            api: process.env.REACT_APP_STATSIG_PROXY_URL,
          }}
        >
          <HeaderWrapper transparent={isHeaderTransparent}>
            <NavBar blur={isHeaderTransparent} />
          </HeaderWrapper>
          <BodyWrapper>
            <Popups />
            <Polling />
            <TopLevelModals />
            <Suspense fallback={<Loader />}>
              {isLoaded ? (
                <Routes>
                  <Route path="/" element={<Landing />} />

                  <Route path="tokens" element={<Tokens />}>
                    <Route path=":chainName" />
                  </Route>
                  <Route path="tokens/:chainName/:tokenAddress" element={<TokenDetails />} />
                  <Route
                    path="vote/*"
                    element={
                      <Suspense fallback={<LazyLoadSpinner />}>
                        <Vote />
                      </Suspense>
                    }
                  />
                  <Route path="create-proposal" element={<Navigate to="/vote/create-proposal" replace />} />
                  <Route path="send" element={<RedirectPathToSwapOnly />} />
                  <Route path="swap" element={<Swap />} />

                  <Route path="pool/v2/find" element={<PoolFinder />} />
                  <Route path="pool/v2" element={<PoolV2 />} />
                  <Route path="pool" element={<Pool />} />
                  <Route path="pool/:tokenId" element={<PositionPage />} />

                  <Route path="pools/v2/find" element={<PoolFinder />} />
                  <Route path="pools/v2" element={<PoolV2 />} />
                  <Route path="pools" element={<Pool />} />
                  <Route path="pools/:tokenId" element={<PositionPage />} />

                  <Route path="add/v2" element={<RedirectDuplicateTokenIdsV2 />}>
                    <Route path=":currencyIdA" />
                    <Route path=":currencyIdA/:currencyIdB" />
                  </Route>
                  <Route path="add" element={<RedirectDuplicateTokenIds />}>
                    {/* this is workaround since react-router-dom v6 doesn't support optional parameters any more */}
                    <Route path=":currencyIdA" />
                    <Route path=":currencyIdA/:currencyIdB" />
                    <Route path=":currencyIdA/:currencyIdB/:feeAmount" />
                  </Route>

                  <Route path="increase" element={<AddLiquidity />}>
                    <Route path=":currencyIdA" />
                    <Route path=":currencyIdA/:currencyIdB" />
                    <Route path=":currencyIdA/:currencyIdB/:feeAmount" />
                    <Route path=":currencyIdA/:currencyIdB/:feeAmount/:tokenId" />
                  </Route>

                  <Route path="remove/v2/:currencyIdA/:currencyIdB" element={<RemoveLiquidity />} />
                  <Route path="remove/:tokenId" element={<RemoveLiquidityV3 />} />

                  <Route path="migrate/v2" element={<MigrateV2 />} />
                  <Route path="migrate/v2/:address" element={<MigrateV2Pair />} />

                  {!shouldDisableNFTRoutes && (
                    <>
                      <Route
                        path="/nfts"
                        element={
                          <Suspense fallback={null}>
                            <NftExplore />
                          </Suspense>
                        }
                      />

                      <Route
                        path="/nfts/asset/:contractAddress/:tokenId"
                        element={
                          <Suspense fallback={null}>
                            <Asset />
                          </Suspense>
                        }
                      />

                      <Route
                        path="/nfts/profile"
                        element={
                          <Suspense fallback={null}>
                            <Profile />
                          </Suspense>
                        }
                      />

                      <Route
                        path="/nfts/collection/:contractAddress"
                        element={
                          <Suspense fallback={null}>
                            <Collection />
                          </Suspense>
                        }
                      />

                      <Route
                        path="/nfts/collection/:contractAddress/activity"
                        element={
                          <Suspense fallback={null}>
                            <Collection />
                          </Suspense>
                        }
                      />
                    </>
                  )}

                  <Route path="*" element={<Navigate to="/not-found" replace />} />
                  <Route path="/not-found" element={<NotFound />} />
                </Routes>
              ) : (
                <Loader />
              )}
            </Suspense>
          </BodyWrapper>
          <MobileBottomBar>
            <PageTabs />
          </MobileBottomBar>
        </StatsigProvider>
      </Trace>
    </ErrorBoundary>
  )
}
