import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'AIZOYA Gather — Find your common ground',description:'Plan an outing around everyone’s tastes. A group decision tool built for Qloo.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
