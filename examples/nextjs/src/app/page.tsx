'use client'

import Image from 'next/image'
import styles from './page.module.css'
import { Connect } from './Connect'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.center}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Next.js Logo"
          width={180}
          height={37}
          priority
        />
        <h1 className={styles.heading}>@txnlab/use-wallet-react</h1>
        <Connect />
      </div>
    </main>
  )
}
