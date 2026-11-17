import { useState } from 'react'

// Images ship with the project in /public/images. If one is missing the
// component falls back to the deployment the assets were taken from, so the
// layout never collapses into broken icons.
const FALLBACK_ORIGIN =
  'https://61w8zr-2vdilh1kx-arcadawebapps4.vercel.app'

export default function Img({ src, alt = '', className = '', ...rest }) {
  const [failed, setFailed] = useState(false)
  const resolved = failed ? `${FALLBACK_ORIGIN}${src}` : src

  return (
    <img
      src={resolved}
      alt={alt}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  )
}
