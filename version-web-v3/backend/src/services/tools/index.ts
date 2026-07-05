import { ToolResult, EmitFn, firstOf } from './utils';
import { searchPlaces, searchDatabaseTool, getPlaceAlternativesTool } from './search';
import { createItineraryTool, editItineraryTool, getItineraryTool, listItinerariesTool, deleteItineraryTool } from './itinerary';
import { routeDistanceTool, findTransportTool, getTravelTimeTool, optimizeRouteTool } from './transport';
import { setPreferencesTool } from './preferences';
import { checkAccessibilityTool } from './accessibilityChecks';
import { getBusEtaByRouteAndStop } from '../busService';
import { isMTRStationAccessible, findNearestMtr, estimateMtrTime } from './mtr';
import { haversineMeters } from './utils';

export { ToolResult, EmitFn, haversineMeters, isMTRStationAccessible, findNearestMtr, estimateMtrTime };
export type { MtrStation } from './mtr';

export const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: 'Search for places by category, name, region, or keywords. Regions: kowloon, hong_kong_island, new_territories. Budgets: free, cheap, moderate, expensive. Categories are flexible — any type of place.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What the user is looking for, e.g. "museums in Tsim Sha Tsui" or "parks near me"' },
          region: { type: 'string', description: 'Region filter: kowloon, hong_kong_island, new_territories' },
          budget: { type: 'string', description: 'Budget filter: free, cheap, moderate, expensive' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_place_alternatives',
      description: 'Find alternative places similar to a given place. Use when a place is closed, inaccessible, too far, or user wants options.',
      parameters: {
        type: 'object',
        properties: {
          place_name: { type: 'string', description: 'Name of the place to find alternatives for' },
          reason: { type: 'string', description: 'Why alternatives are needed (closed, inaccessible, too far, fully booked, etc.)' },
          category: { type: 'string', description: 'Category to search in (museum, park, restaurant, etc.)' },
        },
        required: ['place_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_accessibility',
      description: 'Check accessibility information for a place. Returns wheelchair access, step-free entry, accessible bathrooms, etc.',
      parameters: {
        type: 'object',
        properties: {
          place_name: { type: 'string', description: 'Name of the place to check' },
        },
        required: ['place_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_preferences',
      description: 'Save or update user preferences globally. Call ONLY when the user explicitly tells you about their mobility, interests, budget, or home base. DO NOT infer or guess — only use info the user directly states. After calling, tell the user what you saved.',
      parameters: {
        type: 'object',
        properties: {
          mobility: { type: 'string', description: 'Mobility status — values: none, wheelchair, cane, slow, fast, hearing_impaired, visually_impaired, elderly, with_kids, pregnant, other_needs. Only set if user explicitly mentions it.' },
          interests: { type: 'array', items: { type: 'string' }, description: 'Interests — free-text categories the user likes (e.g. museum, park, cafe, shopping, hiking, etc.). Only set if user explicitly mentions categories they like.' },
          budget_level: { type: 'string', description: 'Budget level — values: cheap, medium, expensive. Only set if user explicitly mentions budget.' },
          budget_min_hkd: { type: 'number', description: 'Minimum daily budget in HKD — only set if user gives a specific number or range.' },
          budget_max_hkd: { type: 'number', description: 'Maximum daily budget in HKD — only set if user gives a specific number or range.' },
          home_base: { type: 'string', description: 'Area/neighborhood user is staying in — only set if user explicitly states it' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_itinerary',
      description: 'Create a new multi-day Kowloon itinerary. Plans stops, searches for real places, optimizes walking route, and saves to database.',
      parameters: {
        type: 'object',
        properties: {
          preferences: { type: 'string', description: 'User\'s trip preferences, interests, and requirements' },
          days: { type: 'number', description: 'Number of days for the trip (default 1)' },
          existing_itinerary_id: { type: 'number', description: 'If modifying an existing trip, pass its ID here so previous stops are used as context' },
        },
        required: ['preferences'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_itinerary',
      description: 'Modify an existing itinerary. Can add stops, remove stops, or reorder. Requires an active itinerary ID.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to modify' },
          changes: { type: 'string', description: 'Description of what to change, e.g. "remove Museum of Art" or "add a park"' },
        },
        required: ['itinerary_id', 'changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_itinerary',
      description: 'Get full details of an itinerary including all stops, their order, times, and walking distances between them.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to fetch' },
        },
        required: ['itinerary_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_itineraries',
      description: 'List all saved itineraries with their IDs, user descriptions, and stop counts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_itinerary',
      description: 'Delete an itinerary and all its stops. This cannot be undone.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to delete' },
        },
        required: ['itinerary_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'route_distance',
      description: 'Get the real walking distance and time between two locations using OSRM. Use this instead of guessing linear distance.',
      parameters: {
        type: 'object',
        properties: {
          from_lat: { type: 'number', description: 'Starting latitude' },
          from_lng: { type: 'number', description: 'Starting longitude' },
          to_lat: { type: 'number', description: 'Destination latitude' },
          to_lng: { type: 'number', description: 'Destination longitude' },
        },
        required: ['from_lat', 'from_lng', 'to_lat', 'to_lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_transport',
      description: 'Find transport options between two locations when walking is not practical (more than ~10 minutes). Returns MTR and bus estimates with travel times.',
      parameters: {
        type: 'object',
        properties: {
          from_name: { type: 'string', description: 'Name of the origin location' },
          from_lat: { type: 'number', description: 'Origin latitude' },
          from_lng: { type: 'number', description: 'Origin longitude' },
          to_name: { type: 'string', description: 'Name of the destination location' },
          to_lat: { type: 'number', description: 'Destination latitude' },
          to_lng: { type: 'number', description: 'Destination longitude' },
        },
        required: ['from_name', 'from_lat', 'from_lng', 'to_name', 'to_lat', 'to_lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'optimize_route',
      description: 'Re-order a set of stops to minimize total walking distance. Uses nearest-neighbor algorithm to avoid back-and-forth travel.',
      parameters: {
        type: 'object',
        properties: {
          stops: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                lat: { type: 'number' },
                lng: { type: 'number' },
              },
            },
            description: 'Array of stops with name, lat, lng to optimize',
          },
        },
        required: ['stops'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_travel_time',
      description: 'Get the total travel time between two places by a specific mode (walking, transit). Combines walking to station, transit, and walking from station.',
      parameters: {
        type: 'object',
        properties: {
          from_lat: { type: 'number' },
          from_lng: { type: 'number' },
          to_lat: { type: 'number' },
          to_lng: { type: 'number' },
          mode: { type: 'string', enum: ['walking', 'transit'], description: 'Mode of travel' },
        },
        required: ['from_lat', 'from_lng', 'to_lat', 'to_lng', 'mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bus_eta',
      description: 'Get real-time bus arrival times for Citybus (CTB) or KMB routes in Hong Kong. Provide a route number and optionally a stop name, stop ID, and company. Without a stop, lists all stops on the route. Supports both Citybus (CTB) and KMB.',
      parameters: {
        type: 'object',
        properties: {
          route: { type: 'string', description: 'Bus route number, e.g. "1", "1A", "8P", "970"' },
          stop: { type: 'string', description: 'Optional stop name or stop ID to get ETA for. Omit to list all stops on the route.' },
          stop_id: { type: 'string', description: 'Optional 6-digit (CTB) stop ID instead of stop name' },
          company: { type: 'string', enum: ['CTB', 'KMB'], description: 'Bus company: CTB (Citybus) or KMB (Kowloon Motor Bus). Default CTB.' },
        },
        required: ['route'],
      },
    },
  },
];

export async function executeTool(name: string, args: any, emit: EmitFn): Promise<ToolResult> {
  emit(`Running tool: ${name}`);
  switch (name) {
    case 'search_places':
      return searchPlaces(firstOf(args, 'query', 'category', 'interest', 'keywords', 'name', 'q') || '',
        firstOf(args, 'region', 'area') || '',
        firstOf(args, 'budget', 'price', 'cost') || '',
        emit);
    case 'create_itinerary':
      return createItineraryTool(
        parseInt(firstOf(args, 'days', 'num_days', 'number_of_days')) || 1,
        firstOf(args, 'preferences', 'preference', 'interests', 'interest', 'theme', 'description') || 'general Kowloon trip',
        emit,
        firstOf(args, 'existing_itinerary_id', 'itinerary_id'),
        firstOf(args, 'region', 'area') || 'kowloon'
      );
    case 'edit_itinerary': return editItineraryTool(
      firstOf(args, 'itinerary_id', 'id'),
      firstOf(args, 'changes', 'action', 'modification', 'stops', 'modifications') || '',
      emit
    );
    case 'get_itinerary': return getItineraryTool(firstOf(args, 'itinerary_id', 'id', 'trip_id'));
    case 'list_itineraries': return listItinerariesTool();
    case 'delete_itinerary': return deleteItineraryTool(firstOf(args, 'itinerary_id', 'id'));
    case 'route_distance':
      return routeDistanceTool(
        parseFloat(firstOf(args, 'from_lat', 'origin_lat', 'lat1')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng', 'lng1')) || 0,
        parseFloat(firstOf(args, 'to_lat', 'dest_lat', 'lat2')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng', 'lng2')) || 0,
        firstOf(args, 'from_name', 'origin', 'from'),
        firstOf(args, 'to_name', 'destination', 'to')
      );
    case 'find_transport':
      return findTransportTool(
        firstOf(args, 'from_name', 'origin', 'from'),
        parseFloat(firstOf(args, 'from_lat', 'origin_lat')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng')) || 0,
        firstOf(args, 'to_name', 'destination', 'to'),
        parseFloat(firstOf(args, 'to_lat', 'dest_lat')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng')) || 0
      );
    case 'get_travel_time':
      return getTravelTimeTool(
        parseFloat(firstOf(args, 'from_lat', 'origin_lat')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng')) || 0,
        parseFloat(firstOf(args, 'to_lat', 'dest_lat')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng')) || 0,
        firstOf(args, 'mode', 'transport', 'method') || 'walking',
        firstOf(args, 'from_name', 'origin', 'from'),
        firstOf(args, 'to_name', 'destination', 'to')
      );
    case 'optimize_route': return optimizeRouteTool(firstOf(args, 'stops', 'waypoints', 'places'));
    case 'search_database': return searchDatabaseTool(firstOf(args, 'query', 'q', 'search', 'term'));
    case 'get_place_alternatives':
      return getPlaceAlternativesTool(
        firstOf(args, 'place_name', 'name', 'place'),
        firstOf(args, 'reason', 'why', 'issue'),
        firstOf(args, 'category', 'type', 'kind')
      );
    case 'check_accessibility':
      return checkAccessibilityTool(firstOf(args, 'place_name', 'name', 'place', 'location', 'query', 'q'));
    case 'set_preferences':
      return setPreferencesTool(args, emit);
    case 'get_bus_eta': {
      const route = firstOf(args, 'route', 'bus', 'line') || '';
      const stop = firstOf(args, 'stop', 'stop_name', 'location', 'place') || '';
      const stopId = firstOf(args, 'stop_id', 'stopId', 'id') || '';
      const company = (firstOf(args, 'company', 'bus_company', 'operator') || 'CTB').toUpperCase();
      const result = await getBusEtaByRouteAndStop(route, stop, stopId, company);
      return { response: result.response, thinking: [result.response] };
    }
    default: return { response: `Unknown tool: ${name}` };
  }
}
