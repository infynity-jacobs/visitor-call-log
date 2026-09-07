import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function BrandingHeader() {
  const [branding, setBranding] = useState(null);
  useEffect(() => { api.request('/settings/branding').then((d) => setBranding(d.branding)).catch(() => {}); }, []);
  if (!branding) return null;
  return (
    <div className="branding-header">
      {branding.logo_path && <img src={branding.logo_path} alt="Organization logo" className="branding-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <div>
        <div className="branding-name">{branding.org_name}</div>
        {branding.address && <div className="branding-meta">{branding.address}</div>}
        {(branding.phone || branding.email || branding.website) && <div className="branding-meta">{[branding.phone, branding.email, branding.website].filter(Boolean).join(' | ')}</div>}
      </div>
    </div>
  );
}
