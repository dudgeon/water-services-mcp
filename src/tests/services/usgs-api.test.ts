import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { USGSApiService } from '../../services/usgs-api.js';
import type { USGSAPIResponse } from '../../types/potomac-data.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('USGSApiService', () => {
  let service: USGSApiService;

  beforeEach(() => {
    service = new USGSApiService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentWaterLevel', () => {
    it('should fetch and parse current water level data successfully', async () => {
      // Mock current water level response
      const mockCurrentResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: {
              locationParam: '[ALL:01647600]',
              variableParam: '[00065]'
            },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Wisconsin Ave, Washington DC',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{
                value: '00065',
                network: 'NWIS',
                vocabulary: 'NWIS',
                variableID: 45807042,
                default: true
              }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: {
                unitCode: 'ft',
                unitName: 'feet',
                unitType: 'Length',
                unitAbbreviation: 'ft'
              },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '5.42',
                qualifiers: ['P'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock historical response
      const mockHistoricalResponse: USGSAPIResponse = {
        ...mockCurrentResponse,
        value: {
          ...mockCurrentResponse.value,
          timeSeries: [{
            ...mockCurrentResponse.value.timeSeries[0],
            values: [{
              value: [
                { value: '5.42', qualifiers: ['P'], dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: '5.35', qualifiers: ['P'], dateTime: '2024-01-14T10:30:00.000-05:00' },
                { value: '5.50', qualifiers: ['P'], dateTime: '2024-01-13T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      // Mock fetch calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();

      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(5.42);
      expect(result?.wmlw_ft).toBe(4.42); // NAVD88 - 1.0
      expect(result?.seven_day_min_ft).toBe(5.35);
      expect(result?.seven_day_max_ft).toBe(5.50);
      expect(result?.stale).toBe(true); // Old timestamp should be stale
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when API response is empty', async () => {
      const mockEmptyResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: []
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock both the current and historical calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmptyResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should correctly target station 01647600 (Georgetown)', async () => {
      const mockCurrentResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600&parameterCd=00065',
            criteria: {
              locationParam: '[ALL:01647600]',
              variableParam: '[00065]'
            },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Wisconsin Ave, Washington DC',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{
                value: '00065',
                network: 'NWIS',
                vocabulary: 'NWIS',
                variableID: 45807042,
                default: true
              }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: {
                unitCode: 'ft',
                unitName: 'feet',
                unitType: 'Length',
                unitAbbreviation: 'ft'
              },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '6.25',
                qualifiers: ['A'],
                dateTime: '2024-01-15T15:45:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse: USGSAPIResponse = {
        ...mockCurrentResponse,
        value: {
          ...mockCurrentResponse.value,
          timeSeries: [{
            ...mockCurrentResponse.value.timeSeries[0],
            values: [{
              value: [
                { value: '6.25', qualifiers: ['A'], dateTime: '2024-01-15T15:45:00.000-05:00' },
                { value: '5.80', qualifiers: ['A'], dateTime: '2024-01-14T15:45:00.000-05:00' },
                { value: '6.50', qualifiers: ['A'], dateTime: '2024-01-13T15:45:00.000-05:00' },
                { value: '5.95', qualifiers: ['A'], dateTime: '2024-01-12T15:45:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();

      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(6.25);
      expect(result?.wmlw_ft).toBe(5.25); // NAVD88 - 1.0
      expect(result?.seven_day_min_ft).toBe(5.80);
      expect(result?.seven_day_max_ft).toBe(6.50);
      expect(result?.timestamp).toBe('2024-01-15T15:45:00.000-05:00');
      
      // Verify the correct API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check that the first call (current data) has the right parameters
      const firstCallUrl = mockFetch.mock.calls[0][0];
      expect(firstCallUrl).toContain('sites=01647600');
      expect(firstCallUrl).toContain('parameterCd=00065');
    });

    it('should calculate 7-day min/max correctly from historical data', async () => {
      const currentTime = new Date().toISOString();
      
      const mockCurrentResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Wisconsin Ave, Washington DC',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 45807042, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '7.15',
                qualifiers: ['A'],
                dateTime: currentTime
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse: USGSAPIResponse = {
        ...mockCurrentResponse,
        value: {
          ...mockCurrentResponse.value,
          timeSeries: [{
            ...mockCurrentResponse.value.timeSeries[0],
            values: [{
              value: [
                { value: '7.15', qualifiers: ['A'], dateTime: currentTime },
                { value: '4.25', qualifiers: ['A'], dateTime: '2024-01-14T15:45:00.000-05:00' }, // Min
                { value: '8.90', qualifiers: ['A'], dateTime: '2024-01-13T15:45:00.000-05:00' }, // Max
                { value: '6.50', qualifiers: ['A'], dateTime: '2024-01-12T15:45:00.000-05:00' },
                { value: '5.75', qualifiers: ['A'], dateTime: '2024-01-11T15:45:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();

      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(7.15);
      expect(result?.seven_day_min_ft).toBe(4.25); // Should find the minimum
      expect(result?.seven_day_max_ft).toBe(8.90); // Should find the maximum
      expect(result?.stale).toBe(false); // Current time should not be stale
    });

    it('should handle NAVD88 to WMLW conversion correctly', async () => {
      const currentTime = new Date().toISOString();
      
      const testCases = [
        { navd88: 5.50, expectedWmlw: 4.50 },
        { navd88: 10.25, expectedWmlw: 9.25 },
        { navd88: 2.75, expectedWmlw: 1.75 },
        { navd88: 0.50, expectedWmlw: -0.50 }
      ];

      for (const testCase of testCases) {
        const mockResponse: USGSAPIResponse = {
          name: 'ns1:timeSeriesResponseType',
          declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
          scope: 'javax.xml.bind.JAXBElement$GlobalScope',
          value: {
            queryInfo: {
              queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
              criteria: { locationParam: '[ALL:01647600]' },
              note: []
            },
            timeSeries: [{
              sourceInfo: {
                siteName: 'Potomac River at Wisconsin Ave, Washington DC',
                siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
                timeZoneInfo: {
                  defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                  daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                  siteUsesDaylightSavingsTime: true
                },
                geoLocation: {
                  geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                  localSiteXY: []
                },
                note: [],
                siteType: [],
                siteProperty: []
              },
              variable: {
                variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 45807042, default: true }],
                variableName: 'Gage height, feet',
                variableDescription: 'Gage height, feet',
                valueType: 'Derived Value',
                unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
                options: { option: [] },
                noDataValue: -999999
              },
              values: [{
                value: [{
                  value: testCase.navd88.toString(),
                  qualifiers: ['A'],
                  dateTime: currentTime
                }],
                qualifier: [],
                qualityControlLevel: [],
                method: [],
                source: []
              }],
              name: 'USGS:01647600:00065:00000'
            }]
          },
          nil: false,
          globalScope: true,
          typeSubstituted: false
        };

        // Clear previous mocks
        vi.clearAllMocks();

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          });

        const result = await service.getCurrentWaterLevel();

        expect(result).toBeDefined();
        expect(result?.navd88_ft).toBe(testCase.navd88);
        expect(result?.wmlw_ft).toBe(testCase.expectedWmlw);
      }
    });

    it('should detect stale data correctly', async () => {
      // Test with old timestamp (should be stale)
      const oldTimestamp = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 minutes ago
      
      const mockOldResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Wisconsin Ave, Washington DC',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 45807042, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '5.50',
                qualifiers: ['A'],
                dateTime: oldTimestamp
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOldResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOldResponse)
        });

      const result = await service.getCurrentWaterLevel();

      expect(result).toBeDefined();
      expect(result?.stale).toBe(true); // Should be marked as stale
      expect(result?.timestamp).toBe(oldTimestamp);
    });
  });

  describe('getCurrentFlowRate', () => {
    it('should fetch and parse current flow rate data successfully', async () => {
      const mockCurrentResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01646500',
            criteria: {
              locationParam: '[ALL:01646500]',
              variableParam: '[00060]'
            },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River near Little Falls Pump Station',
              siteCode: [{ value: '01646500', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.949, longitude: -77.128 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{
                value: '00060',
                network: 'NWIS',
                vocabulary: 'NWIS',
                variableID: 45807197,
                default: true
              }],
              variableName: 'Discharge, cubic feet per second',
              variableDescription: 'Discharge, cubic feet per second',
              valueType: 'Derived Value',
              unit: {
                unitCode: 'ft3/s',
                unitName: 'cubic feet per second',
                unitType: 'Flow',
                unitAbbreviation: 'ft3/s'
              },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '2850',
                qualifiers: ['A'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01646500:00060:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse: USGSAPIResponse = {
        ...mockCurrentResponse,
        value: {
          ...mockCurrentResponse.value,
          timeSeries: [{
            ...mockCurrentResponse.value.timeSeries[0],
            values: [{
              value: [
                { value: '2850', qualifiers: ['A'], dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: '2650', qualifiers: ['A'], dateTime: '2024-01-14T10:30:00.000-05:00' },
                { value: '3100', qualifiers: ['A'], dateTime: '2024-01-13T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCurrentResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentFlowRate();

      expect(result).toBeDefined();
      expect(result?.discharge_cfs).toBe(2850);
      expect(result?.seven_day_min_cfs).toBe(2650);
      expect(result?.seven_day_max_cfs).toBe(3100);
      expect(result?.stale).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getHistoricalFlowRatePoints', () => {
    it('should fetch and parse historical flow rate data', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01646500&period=P7D',
            criteria: { locationParam: '[ALL:01646500]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River near Little Falls Pump Station',
              siteCode: [{ value: '01646500', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.949, longitude: -77.128 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00060', network: 'NWIS', vocabulary: 'NWIS', variableID: 45807197, default: true }],
              variableName: 'Discharge, cubic feet per second',
              variableDescription: 'Discharge, cubic feet per second',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft3/s', unitName: 'cubic feet per second', unitType: 'Flow', unitAbbreviation: 'ft3/s' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [
                { value: '2850', qualifiers: ['A'], dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: '2650', qualifiers: ['B'], dateTime: '2024-01-14T10:30:00.000-05:00' },
                { value: '3100', qualifiers: ['A'], dateTime: '2024-01-13T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01646500:00060:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.getHistoricalFlowRatePoints();

      expect(result).toHaveLength(3);
      expect(result[0].discharge_cfs).toBe(2850);
      expect(result[0].timestamp).toBe('2024-01-15T10:30:00.000-05:00');
      expect(result[0].quality_code).toBe('A');
      expect(result[0].measurement_grade).toBe('A');
      expect(result[1].measurement_grade).toBe('B');
    });
  });

  describe('getHistoricalWaterLevelPoints', () => {
    it('should fetch and parse historical water level data', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600&period=P7D',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Wisconsin Ave, Washington DC',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 45807042, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [
                { value: '5.42', qualifiers: ['P'], dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: '5.35', qualifiers: ['P'], dateTime: '2024-01-14T10:30:00.000-05:00' },
                { value: '5.50', qualifiers: ['P'], dateTime: '2024-01-13T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.getHistoricalWaterLevelPoints();

      expect(result).toHaveLength(3);
      expect(result[0].navd88_ft).toBe(5.42);
      expect(result[0].wmlw_ft).toBe(4.42);
      expect(result[0].timestamp).toBe('2024-01-15T10:30:00.000-05:00');
      expect(result[0].quality_code).toBe('P');
    });
  });

  describe('timeout handling', () => {
    it('should handle AbortError as timeout', async () => {
      // Mock AbortError which is what happens on timeout
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle timeout errors properly', async () => {
      // Mock a timeout error directly
      const timeoutError = new Error('Request timeout after 5000ms');
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should use correct timeout values for different request types', async () => {
      // This test verifies that the service is configured with correct timeout values
      // We can't easily test the actual timeout behavior in unit tests without making them slow
      // but we can verify the configuration is correct
      
      // Check that the service has the expected timeout configuration
      // by accessing the private properties via reflection (for testing purposes)
      const serviceAny = service as any;
      
      // These timeouts should be set according to the requirements
      expect(serviceAny.defaultTimeout).toBe(5000); // 5 seconds for current data
      expect(serviceAny.historicalTimeout).toBe(8000); // 8 seconds for historical data
    });
  });

  describe('HTTP error handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });
  });

  describe('JSON parsing with various USGS response formats', () => {
    it('should handle response with missing timeSeries array', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: []
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock both current and historical calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with missing values array', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock both current and historical calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with empty value array in values', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock both current and historical calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with invalid numeric values', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: 'NaN',
                qualifiers: ['P'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with missing qualifiers array', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '5.42',
                dateTime: '2024-01-15T10:30:00.000-05:00'
                // Missing qualifiers array
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse: USGSAPIResponse = {
        ...mockResponse,
        value: {
          ...mockResponse.value,
          timeSeries: [{
            ...mockResponse.value.timeSeries[0],
            values: [{
              value: [
                { value: '5.42', dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: '5.35', dateTime: '2024-01-14T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(5.42);
      expect(result?.wmlw_ft).toBe(4.42);
    });

    it('should handle flow rate response with measurement grades in qualifiers', async () => {
      const mockResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01646500',
            criteria: { locationParam: '[ALL:01646500]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Potomac River at Little Falls',
              siteCode: [{ value: '01646500', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00060', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Discharge, cubic feet per second',
              variableDescription: 'Discharge, cubic feet per second',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft3/s', unitName: 'cubic feet per second', unitType: 'Flow', unitAbbreviation: 'ft3/s' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [
                {
                  value: '1500',
                  qualifiers: ['A', 'P'],
                  dateTime: '2024-01-15T10:30:00.000-05:00'
                },
                {
                  value: '1450',
                  qualifiers: ['B', 'P'],
                  dateTime: '2024-01-14T10:30:00.000-05:00'
                },
                {
                  value: '1600',
                  qualifiers: ['C'],
                  dateTime: '2024-01-13T10:30:00.000-05:00'
                }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01646500:00060:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const historical = await service.getHistoricalFlowRatePoints();
      expect(historical).toHaveLength(3);
      expect(historical[0].measurement_grade).toBe('A');
      expect(historical[1].measurement_grade).toBe('B');
      expect(historical[2].measurement_grade).toBe('C');
    });

    it('should handle malformed JSON response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with null value property', async () => {
      const mockResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: null,
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock both current and historical calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });
  });

  describe('Error handling with malformed and empty responses', () => {
    it('should handle completely empty response object', async () => {
      const emptyResponse = {};

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with undefined value property', async () => {
      const malformedResponse = {
        name: 'ns1:timeSeriesResponseType',
        value: undefined
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(malformedResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(malformedResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with missing queryInfo', async () => {
      const incompleteResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          timeSeries: []
        } as any, // Missing queryInfo
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(incompleteResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(incompleteResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with corrupted timeSeries structure', async () => {
      const corruptedResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [
            {
              // Missing required properties like sourceInfo, variable, values
              name: 'USGS:01647600:00065:00000'
            } as any
          ]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(corruptedResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(corruptedResponse)
        });

      const result = await service.getCurrentWaterLevel();
      expect(result).toBeNull();
    });

    it('should handle response with missing dateTime in values', async () => {
      const responseWithMissingDateTime: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '5.42'
                // Missing dateTime property
              } as any],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse = {
        ...responseWithMissingDateTime,
        value: {
          ...responseWithMissingDateTime.value,
          timeSeries: [{
            ...responseWithMissingDateTime.value.timeSeries[0],
            values: [{
              value: [
                { value: '5.42' },
                { value: '5.35' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(responseWithMissingDateTime)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();
      // Should still work as dateTime is accessed but not validated
      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(5.42);
    });

    it('should handle flow rate response with missing measurement data', async () => {
      const flowResponseMissingData: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01646500',
            criteria: { locationParam: '[ALL:01646500]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01646500', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00060', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Discharge, cubic feet per second',
              variableDescription: 'Discharge, cubic feet per second',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft3/s', unitName: 'cubic feet per second', unitType: 'Flow', unitAbbreviation: 'ft3/s' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '-999999', // USGS no-data value
                qualifiers: ['P'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01646500:00060:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(flowResponseMissingData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(flowResponseMissingData)
        });

      const result = await service.getCurrentFlowRate();
      // Should handle USGS no-data value appropriately
      expect(result).toBeDefined();
      expect(result?.discharge_cfs).toBe(-999999);
    });

    it('should handle network failure during historical data fetch', async () => {
      const validCurrentResponse: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: '5.42',
                qualifiers: ['P'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      // Mock successful current data fetch but failed historical fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validCurrentResponse)
        })
        .mockRejectedValueOnce(new Error('Network error during historical fetch'));

      const result = await service.getCurrentWaterLevel();
      // Should still return current data even if historical fails
      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(5.42);
      expect(result?.seven_day_min_ft).toBe(5.42); // Falls back to current value
      expect(result?.seven_day_max_ft).toBe(5.42); // Falls back to current value
    });

    it('should handle response with non-string value field', async () => {
      const responseWithNonStringValue: USGSAPIResponse = {
        name: 'ns1:timeSeriesResponseType',
        declaredType: 'org.cuahsi.waterml.TimeSeriesResponseType',
        scope: 'javax.xml.bind.JAXBElement$GlobalScope',
        value: {
          queryInfo: {
            queryURL: 'https://waterservices.usgs.gov/nwis/iv/?sites=01647600',
            criteria: { locationParam: '[ALL:01647600]' },
            note: []
          },
          timeSeries: [{
            sourceInfo: {
              siteName: 'Test Site',
              siteCode: [{ value: '01647600', network: 'NWIS', agencyCode: 'USGS' }],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: '-05:00', zoneAbbreviation: 'EST' },
                daylightSavingsTimeZone: { zoneOffset: '-04:00', zoneAbbreviation: 'EDT' },
                siteUsesDaylightSavingsTime: true
              },
              geoLocation: {
                geogLocation: { srs: 'EPSG:4326', latitude: 38.905, longitude: -77.057 },
                localSiteXY: []
              },
              note: [],
              siteType: [],
              siteProperty: []
            },
            variable: {
              variableCode: [{ value: '00065', network: 'NWIS', vocabulary: 'NWIS', variableID: 1, default: true }],
              variableName: 'Gage height, feet',
              variableDescription: 'Gage height, feet',
              valueType: 'Derived Value',
              unit: { unitCode: 'ft', unitName: 'feet', unitType: 'Length', unitAbbreviation: 'ft' },
              options: { option: [] },
              noDataValue: -999999
            },
            values: [{
              value: [{
                value: 5.42 as any, // Number instead of string
                qualifiers: ['P'],
                dateTime: '2024-01-15T10:30:00.000-05:00'
              }],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }],
            name: 'USGS:01647600:00065:00000'
          }]
        },
        nil: false,
        globalScope: true,
        typeSubstituted: false
      };

      const mockHistoricalResponse = {
        ...responseWithNonStringValue,
        value: {
          ...responseWithNonStringValue.value,
          timeSeries: [{
            ...responseWithNonStringValue.value.timeSeries[0],
            values: [{
              value: [
                { value: 5.42 as any, dateTime: '2024-01-15T10:30:00.000-05:00' },
                { value: 5.35 as any, dateTime: '2024-01-14T10:30:00.000-05:00' }
              ],
              qualifier: [],
              qualityControlLevel: [],
              method: [],
              source: []
            }]
          }]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(responseWithNonStringValue)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoricalResponse)
        });

      const result = await service.getCurrentWaterLevel();
      // parseFloat should handle number values gracefully
      expect(result).toBeDefined();
      expect(result?.navd88_ft).toBe(5.42);
    });
  });
}); 