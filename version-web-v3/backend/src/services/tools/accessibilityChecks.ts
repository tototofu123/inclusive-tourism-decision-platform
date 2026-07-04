import { getAccessibility } from '../accessibilityService';
import { ToolResult } from './utils';

export async function checkAccessibilityTool(placeName: string): Promise<ToolResult> {
  const info = await getAccessibility(placeName);
  let response = `Accessibility for ${info.placeName}:\n`;
  response += `- Wheelchair access: ${info.wheelchair}\n`;
  if (info.stepFreeEntrance) response += '- Step-free entrance: ✅\n';
  if (info.accessibleToilet) response += '- Accessible toilet: ✅\n';
  if (info.elevator) response += '- Elevator/lift: ✅\n';
  if (info.tactilePaving) response += '- Tactile paving: ✅\n';
  if (info.tags.length > 0) response += `- Tags: ${info.tags.join(', ')}\n`;
  if (info.priceLevel) response += `- Price level: ${info.priceLevel}\n`;
  if (info.openingHours) response += `- Opening hours: ${info.openingHours}\n`;
  if (info.phone) response += `- Phone: ${info.phone}\n`;
  if (info.website) response += `- Website: ${info.website}\n`;
  if (info.notes) response += info.notes;
  return { response };
}
