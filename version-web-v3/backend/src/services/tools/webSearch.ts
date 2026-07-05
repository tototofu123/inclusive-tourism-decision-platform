import { ToolResult, EmitFn } from './utils';

export async function webSearchTool(args: any, emit: EmitFn): Promise<ToolResult> {
  const query = args.query || args.q || args.search || '';
  if (!query) return { response: 'Please provide a search query.' };

  emit(`Searching: ${query.slice(0, 60)}...`);

  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY || process.env.MAPS_API_KEY || ''}&cx=${process.env.GOOGLE_SEARCH_CX || ''}&q=${encodeURIComponent(query + ' Hong Kong')}&num=5`);
    if (res.ok) {
      const data: any = await res.json();
      if (data.items?.length) {
        const snippets = data.items.map((item: any) => `• [${item.title}](${item.link}): ${item.snippet}`).join('\n\n');
        return {
          response: `Web search results for "${query}":\n\n${snippets}`,
          thinking: ['Google Custom Search results retrieved for: ' + query],
        };
      }
    }
    
    // If no dedicated search API, use a simple fetch + parse approach
    const fallbackRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`);
    if (fallbackRes.ok) {
      const data: any = await fallbackRes.json();
      const extract = data.extract || '';
      if (extract) {
        return {
          response: `**${data.title}**\n\n${extract.slice(0, 1500)}${extract.length > 1500 ? '...' : ''}\n\nSource: Wikipedia`,
          thinking: ['Searched web for: ' + query],
        };
      }
    }

    // Wikipedia search fallback
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' Hong Kong')}&format=json&srlimit=3`);
    if (searchRes.ok) {
      const data: any = await searchRes.json();
      const results = data.query?.search || [];
      if (results.length > 0) {
        const snippets = results.map((r: any) => `• ${r.title}: ${r.snippet.replace(/<\/?[^>]+(>|$)/g, '').slice(0, 200)}...`).join('\n\n');
        return {
          response: `Search results for "${query}" in Hong Kong:\n\n${snippets}`,
          thinking: ['Searched web for: ' + query],
        };
      }
    }

    // Google Places fallback — search for the query as a place
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.MAPS_API_KEY || '',
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours',
      },
      body: JSON.stringify({ textQuery: query + ' Hong Kong', pageSize: 3 }),
    });
    if (placesRes.ok) {
      const data: any = await placesRes.json();
      const results = data.places || [];
      if (results.length > 0) {
        const info = results.map((p: any) => {
          const name = p.displayName?.text || '';
          const addr = p.formattedAddress || '';
          const rating = p.rating ? `★ ${p.rating}/5` : '';
          const summary = p.editorialSummary?.text || '';
          return `**${name}**${rating ? ' ' + rating : ''}\n${addr}${summary ? '\n' + summary : ''}`;
        }).join('\n\n');
        return { response: `Places matching "${query}":\n\n${info}`, thinking: ['Searched Google Places for: ' + query] };
      }
    }

    return { response: `I searched for "${query}" but couldn't find specific results. Could you try a different search term?` };
  } catch (err) {
    return { response: `Search failed: ${(err as Error).message.slice(0, 100)}` };
  }
}
