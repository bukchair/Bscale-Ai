export async function fetchTikTokCampaigns(accessToken: string, advertiserId: string) {
  const response = await fetch(`/api/tiktok/campaigns?advertiser_id=${advertiserId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch TikTok campaigns');
  }
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.message || 'TikTok API error');
  }
  
  return data.data.list;
}
