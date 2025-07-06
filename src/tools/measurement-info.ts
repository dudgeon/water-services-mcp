import { z } from "zod";

// Input schema for the measurement info tool
export const GetMeasurementInfoSchema = z.object({
  topic: z.enum([
    "water_level_methodology",
    "flow_rate_methodology", 
    "stations",
    "units_datums",
    "quality_codes",
    "data_processing",
    "temporal_context",
    "api_technical",
    "overview"
  ]).optional().describe("Specific topic category to retrieve information about"),
  
  search_term: z.string().optional().describe("Search for specific terms or concepts within the documentation"),
  
  station_id: z.string().optional().describe("Get detailed information about a specific USGS station (e.g., '01647600', '01646500')"),
  
  detail_level: z.enum(["overview", "detailed"]).optional().describe("Level of technical detail to provide")
}).optional();

// Output schema for structured content
export const MeasurementInfoOutputSchema = z.object({
  topic: z.string().describe("The topic category covered"),
  title: z.string().describe("Descriptive title for the information"),
  summary: z.string().describe("Brief summary of the topic"),
  content: z.array(z.object({
    section: z.string().describe("Section heading"),
    description: z.string().describe("Detailed description"),
    key_points: z.array(z.string()).optional().describe("Key points or bullet items"),
    technical_details: z.array(z.string()).optional().describe("Technical specifications and details"),
    examples: z.array(z.string()).optional().describe("Practical examples or use cases")
  })).describe("Structured content sections"),
  related_topics: z.array(z.string()).optional().describe("Related topics for cross-reference"),
  references: z.array(z.string()).optional().describe("External references and sources")
});

export type MeasurementInfoInput = z.infer<typeof GetMeasurementInfoSchema>;
export type MeasurementInfoOutput = z.infer<typeof MeasurementInfoOutputSchema>;

// Content database for measurement methodologies
const MEASUREMENT_CONTENT = {
  water_level_methodology: {
    title: "Water Level Measurement Methodology",
    summary: "Comprehensive guide to water level measurement techniques, datums, and sensor technology used by USGS.",
    sections: [
      {
        section: "NAVD88 Datum",
        description: "North American Vertical Datum of 1988 (NAVD88) is the official vertical datum for the United States.",
        key_points: [
          "Based on a general adjustment of the first-order level nets of the U.S., Canada, and Mexico",
          "References mean sea level at Father Point/Rimouski, Quebec, Canada",
          "Provides consistent elevation reference across North America",
          "Standard datum for most federal mapping and engineering projects"
        ],
        technical_details: [
          "Datum established through precise leveling surveys",
          "Accuracy: ±2 cm for first-order benchmarks",
          "Replaces earlier datums like NGVD29",
          "Geoid model adjustments account for gravitational variations"
        ],
        examples: [
          "Georgetown station reports: 2.5 feet NAVD88",
          "Sea level at Battery Park, NY = 0.0 feet NAVD88",
          "Potomac River typical range: -1.0 to +4.0 feet NAVD88"
        ]
      },
      {
        section: "WMLW Datum",
        description: "Washington Mean Low Water (WMLW) is a local tidal datum specific to the Washington, DC area.",
        key_points: [
          "Based on average of lower low water heights over 19-year tidal cycle",
          "Specific to Washington Harbor and Potomac River tidal influence",
          "Commonly used for navigation and recreational planning in DC area",
          "Approximately 1.27 feet below NAVD88 at Georgetown"
        ],
        technical_details: [
          "Derived from National Tidal Datum Epoch (NTDE) 1983-2001",
          "Relationship to NAVD88: WMLW = NAVD88 - 1.27 feet (approximate)",
          "Varies slightly with location along Potomac River",
          "Updated every 19 years with new tidal observations"
        ],
        examples: [
          "Georgetown: 2.5 ft NAVD88 = 1.23 ft WMLW",
          "Low tide reference for boating: 0.0 ft WMLW",
          "Typical recreational minimum: 2.0 ft WMLW"
        ]
      },
      {
        section: "Measurement Technology",
        description: "Modern water level measurement employs automated sensors and real-time data transmission.",
        key_points: [
          "Pressure transducers measure hydrostatic pressure",
          "Radar sensors provide non-contact measurement",
          "Backup systems ensure data continuity",
          "15-minute measurement intervals for real-time monitoring"
        ],
        technical_details: [
          "Pressure sensor accuracy: ±0.01 feet",
          "Radar sensor accuracy: ±0.02 feet",
          "Temperature compensation for pressure readings",
          "Satellite telemetry for data transmission",
          "Battery backup systems with solar charging"
        ],
        examples: [
          "Georgetown station: Pressure transducer + radar backup",
          "Data transmission: Every 15 minutes via satellite",
          "Quality control: Real-time range and rate-of-change checks"
        ]
      }
    ]
  },
  
  flow_rate_methodology: {
    title: "Flow Rate Measurement Methodology",
    summary: "Detailed explanation of discharge measurement techniques, rating curves, and flow calculation methods.",
    sections: [
      {
        section: "Cubic Feet per Second (CFS)",
        description: "CFS is the standard unit for measuring volumetric flow rate in rivers and streams.",
        key_points: [
          "Volume of water passing a point in one second",
          "Calculated as cross-sectional area × velocity",
          "Standard unit for USGS streamflow measurements",
          "Typically ranges from hundreds to hundreds of thousands of CFS"
        ],
        technical_details: [
          "1 CFS = 1 cubic foot per second = 7.48 gallons per second",
          "1 CFS = 0.0283 cubic meters per second",
          "Measurement accuracy: ±5% for good conditions, ±8% for poor conditions",
          "Flow velocity measured using acoustic Doppler techniques"
        ],
        examples: [
          "Little Falls typical range: 1,000 to 50,000 CFS",
          "Drought conditions: <1,000 CFS",
          "Flood conditions: >100,000 CFS",
          "Average annual flow: ~11,000 CFS"
        ]
      },
      {
        section: "Rating Curves",
        description: "Rating curves establish the relationship between water level (stage) and discharge (flow).",
        key_points: [
          "Mathematical relationship between stage and discharge",
          "Developed through direct flow measurements",
          "Updated regularly to maintain accuracy",
          "Account for channel changes and seasonal variations"
        ],
        technical_details: [
          "Power function: Q = a(G-b)^c, where Q=discharge, G=gage height",
          "Coefficients (a,b,c) determined through regression analysis",
          "Minimum 25-30 discharge measurements for initial rating",
          "Updated when measurement residuals exceed ±8%"
        ],
        examples: [
          "Low flow: 1,000 CFS at 2.0 ft gage height",
          "Moderate flow: 10,000 CFS at 4.0 ft gage height",
          "High flow: 50,000 CFS at 8.0 ft gage height"
        ]
      },
      {
        section: "Acoustic Doppler Measurement",
        description: "Modern flow measurement uses acoustic Doppler current profilers (ADCP) for velocity measurement.",
        key_points: [
          "Sound waves measure water velocity at multiple depths",
          "Provides detailed velocity profile across river cross-section",
          "Integrates velocity and area for total discharge",
          "Suitable for wide range of flow conditions"
        ],
        technical_details: [
          "Frequency: 300-3000 kHz depending on depth and conditions",
          "Velocity accuracy: ±2-5% of measured velocity",
          "Measurement cells: 0.25-1.0 meter vertical resolution",
          "Minimum measurement time: 10-15 minutes for accuracy"
        ],
        examples: [
          "Little Falls: 20-30 velocity cells across 400-foot width",
          "Measurement boat traverses channel 4-6 times",
          "Real-time discharge calculation and quality checks"
        ]
      }
    ]
  },
  
  stations: {
    title: "USGS Monitoring Stations",
    summary: "Detailed information about Georgetown and Little Falls monitoring stations.",
    sections: [
      {
        section: "Georgetown Station (01647600)",
        description: "Water level monitoring station located at Georgetown waterfront in Washington, DC.",
        key_points: [
          "Primary water level monitoring point for DC area",
          "Located at Georgetown waterfront near Key Bridge",
          "Measures gage height every 15 minutes",
          "Provides both NAVD88 and WMLW datum readings"
        ],
        technical_details: [
          "Coordinates: 38.9044°N, 77.0631°W",
          "Datum: NAVD88 and WMLW",
          "Parameter code: 00065 (gage height)",
          "Established: 1980s for real-time monitoring",
          "Sensor type: Pressure transducer with radar backup"
        ],
        examples: [
          "Typical range: -1.0 to +4.0 feet NAVD88",
          "Flood stage: 10.0 feet NAVD88",
          "Navigation minimum: 2.0 feet WMLW",
          "Recreational boating: 3.0+ feet WMLW recommended"
        ]
      },
      {
        section: "Little Falls Station (01646500)",
        description: "Streamflow monitoring station measuring Potomac River discharge upstream of Great Falls.",
        key_points: [
          "Primary discharge measurement point for Potomac River",
          "Located near Little Falls Pump Station",
          "Measures both water level and flow rate",
          "Critical for water supply and flood forecasting"
        ],
        technical_details: [
          "Coordinates: 38.9497°N, 77.1286°W",
          "Drainage area: 11,560 square miles",
          "Parameter codes: 00060 (discharge), 00065 (gage height)",
          "Established: 1930 (continuous record since 1930)",
          "Measurement method: Acoustic Doppler Current Profiler (ADCP)"
        ],
        examples: [
          "Record high: 426,000 CFS (March 1936)",
          "Record low: 540 CFS (August 1966)",
          "Average annual flow: ~11,000 CFS",
          "Drought threshold: <1,000 CFS"
        ]
      }
    ]
  },
  
  units_datums: {
    title: "Units and Datums Reference",
    summary: "Comprehensive reference for measurement units, datum conversions, and standard formats.",
    sections: [
      {
        section: "Measurement Units",
        description: "Standard units used in water level and flow rate measurements.",
        key_points: [
          "Water level: feet (ft) in NAVD88 or WMLW datum",
          "Flow rate: cubic feet per second (CFS)",
          "Time: ISO 8601 format with UTC timezone",
          "Precision: 0.01 ft for water level, 1 CFS for flow rate"
        ],
        technical_details: [
          "Distance: US Survey foot (1200/3937 meters)",
          "Volume: 1 cubic foot = 7.48052 gallons",
          "Flow: 1 CFS = 0.0283168 cubic meters per second",
          "Pressure: 1 foot of water = 0.433 PSI"
        ],
        examples: [
          "Water level: 2.53 feet NAVD88",
          "Flow rate: 12,450 CFS",
          "Timestamp: 2024-01-15T17:30:00Z",
          "Conversion: 10,000 CFS = 74,805 gallons per second"
        ]
      },
      {
        section: "Datum Conversions",
        description: "Conversion between different vertical datums used in the Washington, DC area.",
        key_points: [
          "NAVD88 to WMLW: subtract ~1.27 feet",
          "WMLW to NAVD88: add ~1.27 feet",
          "Conversion varies slightly by location",
          "NGVD29 to NAVD88: add ~1.0 foot (approximate)"
        ],
        technical_details: [
          "Georgetown conversion: WMLW = NAVD88 - 1.274 feet",
          "Little Falls conversion: WMLW = NAVD88 - 1.285 feet",
          "Conversion accuracy: ±0.01 feet",
          "Based on National Tidal Datum Epoch 1983-2001"
        ],
        examples: [
          "3.0 ft NAVD88 = 1.73 ft WMLW",
          "0.0 ft WMLW = 1.27 ft NAVD88",
          "Flood stage: 10.0 ft NAVD88 = 8.73 ft WMLW"
        ]
      }
    ]
  },
  
  quality_codes: {
    title: "Data Quality Codes and Grades",
    summary: "Understanding USGS quality codes, measurement grades, and data reliability indicators.",
    sections: [
      {
        section: "Quality Codes",
        description: "USGS uses standardized quality codes to indicate data reliability and measurement conditions.",
        key_points: [
          "A: Excellent (±2% accuracy)",
          "B: Good (±5% accuracy)",
          "C: Fair (±8% accuracy)",
          "D: Poor (±15% accuracy)",
          "E: Estimated (accuracy unknown)"
        ],
        technical_details: [
          "Based on measurement conditions and sensor performance",
          "Considers ice conditions, debris, equipment malfunctions",
          "Updated in real-time as conditions change",
          "Historical data may be revised with better quality codes"
        ],
        examples: [
          "Clear water, good equipment: Grade A",
          "High flow, some debris: Grade B",
          "Ice conditions: Grade D or E",
          "Sensor malfunction: Grade E (estimated)"
        ]
      },
      {
        section: "Provisional vs Approved Data",
        description: "USGS data goes through review process before final approval.",
        key_points: [
          "Provisional: Real-time data subject to revision",
          "Approved: Data reviewed and finalized (annual process)",
          "Most recent data is always provisional",
          "Historical data (>1 year) typically approved"
        ],
        technical_details: [
          "Provisional data available within 4 hours",
          "Review process includes comparison with field measurements",
          "Rating curve updates may revise historical data",
          "Approval typically occurs 1-2 years after measurement"
        ],
        examples: [
          "Today's data: Provisional",
          "Last year's data: Approved",
          "Recent rating curve change: All data revised"
        ]
      }
    ]
  },
  
  data_processing: {
    title: "Data Processing and Quality Assurance",
    summary: "Methods used to process, validate, and quality-check water monitoring data.",
    sections: [
      {
        section: "Data Collection Intervals",
        description: "Frequency and timing of data collection for different parameters.",
        key_points: [
          "Water level: Every 15 minutes",
          "Flow rate: Every 15 minutes (calculated from water level)",
          "Field measurements: Monthly to quarterly",
          "Data transmission: Real-time via satellite"
        ],
        technical_details: [
          "15-minute interval aligns with National Weather Service needs",
          "Data logger stores 30+ days of measurements locally",
          "Satellite transmission uses GOES system",
          "Backup cellular transmission where available"
        ],
        examples: [
          "Daily measurements: 96 readings per day",
          "Monthly data: ~2,880 readings",
          "Annual data: ~35,000 readings per station"
        ]
      },
      {
        section: "Quality Control Procedures",
        description: "Automated and manual quality control procedures ensure data reliability.",
        key_points: [
          "Range checks: Values within expected limits",
          "Rate-of-change checks: Gradual changes expected",
          "Comparison with nearby stations",
          "Field verification through direct measurements"
        ],
        technical_details: [
          "Georgetown range: -2.0 to +15.0 feet NAVD88",
          "Little Falls range: 0 to 500,000 CFS",
          "Maximum change: 2.0 feet/hour for water level",
          "Automated alerts for values outside normal ranges"
        ],
        examples: [
          "Spike removal: Single high values flagged",
          "Ice conditions: Winter data quality reduced",
          "Sensor drift: Gradual calibration issues detected"
        ]
      },
      {
        section: "Staleness Detection",
        description: "Methods to identify and flag outdated or stale data.",
        key_points: [
          "30-minute threshold for real-time data",
          "Based on expected 15-minute update interval",
          "Accounts for transmission delays",
          "Provides users with data freshness information"
        ],
        technical_details: [
          "Calculation: (current time - measurement time) > 30 minutes",
          "Timezone handling: All times in UTC",
          "Grace period: 30 minutes allows for transmission delays",
          "Stale data still valuable for trend analysis"
        ],
        examples: [
          "Fresh data: 5 minutes old",
          "Stale data: 45 minutes old",
          "Very stale: 2+ hours old (likely equipment issue)"
        ]
      }
    ]
  },
  
  temporal_context: {
    title: "Temporal Context and Data Interpretation",
    summary: "Understanding seasonal variations, historical context, and appropriate data interpretation.",
    sections: [
      {
        section: "Seasonal Variations",
        description: "Annual patterns in water level and flow rate due to weather and human activities.",
        key_points: [
          "Spring: Highest flows from snowmelt and rain",
          "Summer: Lower flows, increased water usage",
          "Fall: Variable flows, hurricane season impacts",
          "Winter: Ice conditions may affect measurements"
        ],
        technical_details: [
          "Peak flow months: March-May",
          "Low flow months: August-October",
          "Snow melt contribution: 20-30% of annual flow",
          "Drought impact: 50-90% flow reduction possible"
        ],
        examples: [
          "Spring flood: 50,000+ CFS common",
          "Summer drought: <2,000 CFS possible",
          "Hurricane impact: 100,000+ CFS peak flows",
          "Winter ice: Measurement quality Grade D"
        ]
      },
      {
        section: "Historical Context",
        description: "Long-term trends and significant events in Potomac River flow history.",
        key_points: [
          "100+ years of streamflow records",
          "Climate change impacts on flow patterns",
          "Major flood events and their impacts",
          "Drought periods and water supply challenges"
        ],
        technical_details: [
          "Record keeping since 1930 at Little Falls",
          "Estimated flows back to 1886 through correlation",
          "Climate trend: Earlier spring peaks, extended dry periods",
          "Flood frequency: 10-year flood ~100,000 CFS"
        ],
        examples: [
          "1936 flood: 426,000 CFS (record high)",
          "1966 drought: 540 CFS (record low)",
          "2012 Derecho: Power outage affected measurements",
          "2016 flood: 200,000+ CFS from Hurricane Matthew"
        ]
      },
      {
        section: "Recreational and Safety Context",
        description: "Guidelines for interpreting water data for recreational activities and safety.",
        key_points: [
          "Minimum boating levels: 2.0+ feet WMLW",
          "Flood stage warnings: 10.0 feet NAVD88",
          "Swift water conditions: >20,000 CFS",
          "Ice conditions: December-February possible"
        ],
        technical_details: [
          "Recreational boating: 3.0+ feet WMLW recommended",
          "Kayaking minimum: 1.5 feet WMLW",
          "Swimming advisory: >30,000 CFS dangerous",
          "Fishing optimal: 2,000-15,000 CFS"
        ],
        examples: [
          "Good boating day: 3.5 ft WMLW, 8,000 CFS",
          "Marginal conditions: 2.2 ft WMLW, 15,000 CFS",
          "Dangerous conditions: 1.0 ft WMLW, 35,000 CFS"
        ]
      }
    ]
  },
  
  api_technical: {
    title: "Technical API and Data Format Information",
    summary: "Technical details about data formats, API structure, and integration patterns.",
    sections: [
      {
        section: "ISO 8601 Duration Formats",
        description: "Standard time period formats used in API requests and data analysis.",
        key_points: [
          "P7D: 7-day period for historical range calculation",
          "PT90M: 90-minute period for trend analysis",
          "P1Y: 1-year period for annual statistics",
          "Standard format ensures consistent time period handling"
        ],
        technical_details: [
          "P = Period designator",
          "D = Days, M = Minutes (after T), Y = Years",
          "T = Time designator (separates date and time components)",
          "Examples: P1M = 1 month, PT2H = 2 hours"
        ],
        examples: [
          "7-day minimum/maximum: period=P7D",
          "90-minute trend: period=PT90M",
          "Annual statistics: period=P1Y",
          "6-hour recent: period=PT6H"
        ]
      },
      {
        section: "JSON Response Structure",
        description: "Standard format for API responses and data structures.",
        key_points: [
          "Nested structure with metadata and data arrays",
          "Timestamps in ISO 8601 format with UTC timezone",
          "Null values for missing or invalid data",
          "Quality codes and metadata included"
        ],
        technical_details: [
          "Root object: value.timeSeries[0].values[0].value",
          "Timestamp format: YYYY-MM-DDTHH:MM:SS.sssZ",
          "Numeric values as strings (USGS format)",
          "Quality codes in separate qualifiers array"
        ],
        examples: [
          "Water level: {'value': '2.53', 'dateTime': '2024-01-15T17:30:00.000Z'}",
          "Flow rate: {'value': '12450', 'dateTime': '2024-01-15T17:30:00.000Z'}",
          "No data: {'value': '-999999', 'dateTime': '2024-01-15T17:30:00.000Z'}"
        ]
      },
      {
        section: "Cache TTL Strategies",
        description: "Caching strategies and time-to-live settings for different data types.",
        key_points: [
          "Current data: 14-minute TTL (shorter for freshness)",
          "Historical data: 30-minute TTL (longer as data doesn't change)",
          "90-minute trend: 14-minute TTL (recent data for trends)",
          "Time-bucketed keys align cache hits"
        ],
        technical_details: [
          "Current data cache: 840 seconds (14 minutes)",
          "Historical data cache: 1800 seconds (30 minutes)",
          "Time buckets: 10-minute windows for current data",
          "Stale data fallback: Up to 24 hours old"
        ],
        examples: [
          "Fresh request: API call, 14-minute cache",
          "Cached request: Instant response from cache",
          "Stale fallback: 2-hour old data when API fails",
          "Emergency fallback: Synthetic response structure"
        ]
      }
    ]
  },
  
  overview: {
    title: "Water Services MCP - Measurement Overview",
    summary: "Complete overview of water level and flow rate measurement systems for the Potomac River.",
    sections: [
      {
        section: "System Overview",
        description: "Comprehensive water monitoring system providing real-time data for the Potomac River.",
        key_points: [
          "Two primary stations: Georgetown (water level) and Little Falls (flow rate)",
          "Real-time data updated every 15 minutes",
          "Multiple measurement technologies for reliability",
          "Comprehensive quality control and data validation"
        ],
        technical_details: [
          "Coverage area: Washington, DC metropolitan area",
          "Data history: 90+ years of continuous records",
          "Measurement accuracy: ±0.01 feet (water level), ±5% (flow rate)",
          "Data transmission: Satellite and cellular backup"
        ],
        examples: [
          "Georgetown: Water level for navigation and recreation",
          "Little Falls: Flow rate for water supply and flood forecasting",
          "Combined: Complete picture of river conditions"
        ]
      },
      {
        section: "Available Tools",
        description: "MCP tools available for accessing water data and technical information.",
        key_points: [
          "get_potomac_gage_depth: Current water level with trend analysis",
          "get_potomac_flow: Current flow rate with trend analysis",
          "get_measurement_info: Technical documentation and methodologies",
          "All tools include staleness detection and quality indicators"
        ],
        technical_details: [
          "90-minute trend analysis for rising/falling/stable determination",
          "7-day historical range for context",
          "Multiple datum formats (NAVD88, WMLW) where applicable",
          "Comprehensive error handling and fallback strategies"
        ],
        examples: [
          "Water level: 2.5 ft NAVD88, rising trend",
          "Flow rate: 12,000 CFS, stable trend",
          "Data age: 8 minutes (fresh)",
          "Quality: Grade A (excellent)"
        ]
      }
    ]
  }
};

/**
 * MCP Tool: get_measurement_info
 * 
 * Provides comprehensive technical documentation about water measurement
 * methodologies, units, datums, and USGS station information.
 * 
 * @param params - Input parameters for topic, search, and detail level
 * @returns Structured measurement methodology information
 */
export async function getMeasurementInfo(
  params: MeasurementInfoInput = {}
): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const { topic, search_term, station_id, detail_level = "overview" } = params;
    
    // Handle station-specific queries
    if (station_id) {
      return handleStationQuery(station_id, detail_level);
    }
    
    // Handle search queries
    if (search_term) {
      return handleSearchQuery(search_term, detail_level);
    }
    
    // Handle topic-specific queries
    if (topic) {
      return handleTopicQuery(topic, detail_level);
    }
    
    // Default: return overview
    return handleTopicQuery("overview", detail_level);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{ 
        type: "text", 
        text: `Error retrieving measurement information: ${errorMessage}. Please try again with a different query.` 
      }]
    };
  }
}

/**
 * Handle station-specific information queries
 */
function handleStationQuery(stationId: string, detailLevel: string): { content: Array<{ type: "text"; text: string }> } {
  const stationInfo = MEASUREMENT_CONTENT.stations;
  let responseText = `# ${stationInfo.title}\n\n`;
  
  // Find matching station
  const targetStation = stationId === "01647600" ? "Georgetown Station (01647600)" : 
                       stationId === "01646500" ? "Little Falls Station (01646500)" : null;
  
  if (!targetStation) {
    return {
      content: [{ 
        type: "text", 
        text: `Station ${stationId} not found. Available stations: 01647600 (Georgetown), 01646500 (Little Falls)` 
      }]
    };
  }
  
  const section = stationInfo.sections.find(s => s.section === targetStation);
  if (!section) {
    return {
      content: [{ 
        type: "text", 
        text: `No detailed information available for station ${stationId}` 
      }]
    };
  }
  
  responseText += `## ${section.section}\n\n`;
  responseText += `${section.description}\n\n`;
  
  if (section.key_points) {
    responseText += `### Key Points:\n`;
    section.key_points.forEach(point => {
      responseText += `- ${point}\n`;
    });
    responseText += `\n`;
  }
  
  if (detailLevel === "detailed" && section.technical_details) {
    responseText += `### Technical Details:\n`;
    section.technical_details.forEach(detail => {
      responseText += `- ${detail}\n`;
    });
    responseText += `\n`;
  }
  
  if (section.examples) {
    responseText += `### Examples:\n`;
    section.examples.forEach(example => {
      responseText += `- ${example}\n`;
    });
    responseText += `\n`;
  }
  
  return {
    content: [{ type: "text", text: responseText }]
  };
}

/**
 * Handle search queries across all content
 */
function handleSearchQuery(searchTerm: string, detailLevel: string): { content: Array<{ type: "text"; text: string }> } {
  const searchLower = searchTerm.toLowerCase();
  const matches: Array<{ topic: string; section: string; relevance: number; content: any }> = [];
  
  // Search through all content
  Object.entries(MEASUREMENT_CONTENT).forEach(([topicKey, topicData]) => {
    topicData.sections.forEach(section => {
      let relevance = 0;
      
      // Check section title
      if (section.section.toLowerCase().includes(searchLower)) relevance += 10;
      
      // Check description
      if (section.description.toLowerCase().includes(searchLower)) relevance += 8;
      
      // Check key points
      if (section.key_points) {
        section.key_points.forEach(point => {
          if (point.toLowerCase().includes(searchLower)) relevance += 5;
        });
      }
      
      // Check technical details
      if (section.technical_details) {
        section.technical_details.forEach(detail => {
          if (detail.toLowerCase().includes(searchLower)) relevance += 3;
        });
      }
      
      // Check examples
      if (section.examples) {
        section.examples.forEach(example => {
          if (example.toLowerCase().includes(searchLower)) relevance += 2;
        });
      }
      
      if (relevance > 0) {
        matches.push({ 
          topic: topicKey, 
          section: section.section, 
          relevance, 
          content: section 
        });
      }
    });
  });
  
  // Sort by relevance
  matches.sort((a, b) => b.relevance - a.relevance);
  
  if (matches.length === 0) {
    return {
      content: [{ 
        type: "text", 
        text: `No matches found for "${searchTerm}". Try searching for terms like: NAVD88, CFS, station, methodology, quality, datum, etc.` 
      }]
    };
  }
  
  let responseText = `# Search Results for "${searchTerm}"\n\n`;
  responseText += `Found ${matches.length} matching section(s):\n\n`;
  
  // Show top 3 matches
  matches.slice(0, 3).forEach((match, index) => {
    responseText += `## ${index + 1}. ${match.content.section}\n\n`;
    responseText += `${match.content.description}\n\n`;
    
    if (match.content.key_points) {
      responseText += `### Key Points:\n`;
      match.content.key_points.forEach((point: string) => {
        responseText += `- ${point}\n`;
      });
      responseText += `\n`;
    }
    
    if (detailLevel === "detailed" && match.content.technical_details) {
      responseText += `### Technical Details:\n`;
      match.content.technical_details.forEach((detail: string) => {
        responseText += `- ${detail}\n`;
      });
      responseText += `\n`;
    }
  });
  
  if (matches.length > 3) {
    responseText += `\n*Additional ${matches.length - 3} matches available. Try more specific search terms for better results.*\n`;
  }
  
  return {
    content: [{ type: "text", text: responseText }]
  };
}

/**
 * Handle topic-specific queries
 */
function handleTopicQuery(topic: string, detailLevel: string): { content: Array<{ type: "text"; text: string }> } {
  const topicData = MEASUREMENT_CONTENT[topic as keyof typeof MEASUREMENT_CONTENT];
  
  if (!topicData) {
    const availableTopics = Object.keys(MEASUREMENT_CONTENT).join(", ");
    return {
      content: [{ 
        type: "text", 
        text: `Topic "${topic}" not found. Available topics: ${availableTopics}` 
      }]
    };
  }
  
  let responseText = `# ${topicData.title}\n\n`;
  responseText += `${topicData.summary}\n\n`;
  
  topicData.sections.forEach(section => {
    responseText += `## ${section.section}\n\n`;
    responseText += `${section.description}\n\n`;
    
    if (section.key_points) {
      responseText += `### Key Points:\n`;
      section.key_points.forEach(point => {
        responseText += `- ${point}\n`;
      });
      responseText += `\n`;
    }
    
    if (detailLevel === "detailed" && section.technical_details) {
      responseText += `### Technical Details:\n`;
      section.technical_details.forEach(detail => {
        responseText += `- ${detail}\n`;
      });
      responseText += `\n`;
    }
    
    if (section.examples) {
      responseText += `### Examples:\n`;
      section.examples.forEach(example => {
        responseText += `- ${example}\n`;
      });
      responseText += `\n`;
    }
  });
  
  return {
    content: [{ type: "text", text: responseText }]
  };
}