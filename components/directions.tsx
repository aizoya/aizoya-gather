export function Directions({address}:{address:string}) {
 if(!address?.trim())return null;
 const destination=encodeURIComponent(address.trim());
 return <div className="directions"><span>Navigate to the listed address:</span><a href={'https://maps.apple.com/?daddr='+destination} target="_blank" rel="noopener noreferrer">Apple Maps ↗</a><a href={'https://www.google.com/maps/dir/?api=1&destination='+destination} target="_blank" rel="noopener noreferrer">Google Maps ↗</a><small>Check the destination before traveling. Directions do not verify opening hours or availability.</small></div>;
}
