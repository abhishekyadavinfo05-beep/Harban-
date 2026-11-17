import { getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import firebaseConfig from '../../firebase-applet-config.json'

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleAuthProvider = new GoogleAuthProvider()

const otpApp =
  getApps().find((a) => a.name === 'harban-phone-otp') ||
  initializeApp(firebaseConfig, 'harban-phone-otp')
export const phoneOtpAuth = getAuth(otpApp)

