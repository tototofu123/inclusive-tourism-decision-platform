import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import ErrorBoundary from '../components/ErrorBoundary'
export default function App({ Component, pageProps }: AppProps) {
  return <>
    <Head>
      <title>Kowloon Explorer - Inclusive Tourism</title>
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <ErrorBoundary><Component {...pageProps} /></ErrorBoundary>
  </>
}
