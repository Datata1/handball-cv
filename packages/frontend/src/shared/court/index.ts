// One handball court, drawn once. Spatial views compose it and position their
// data in metres — the same frame the backend reports in.

export { Court, type CourtData, CourtLayer, type CourtProps } from './Court'
export { COURT_LENGTH_M, COURT_WIDTH_M, type CourtEnd, goalLineX } from './geometry'
export {
  type CourtOrientation,
  type CourtPoint,
  type CourtProjection,
  useCourtProjection,
} from './projection'
export {
  type CourtHalf,
  type CourtZone,
  courtZone,
  ZONE_CODES,
  type ZoneCode,
  zonesForHalf,
} from './zones'
