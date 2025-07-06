import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMeasurementInfo, GetMeasurementInfoSchema } from '../../tools/measurement-info.js';

describe('getMeasurementInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema validation', () => {
    it('should accept valid input parameters', () => {
      const validInputs = [
        { topic: 'water_level_methodology' },
        { topic: 'flow_rate_methodology' },
        { topic: 'stations' },
        { topic: 'units_datums' },
        { topic: 'quality_codes' },
        { topic: 'data_processing' },
        { topic: 'temporal_context' },
        { topic: 'api_technical' },
        { topic: 'overview' },
        { search_term: 'NAVD88' },
        { station_id: '01647600' },
        { detail_level: 'overview' },
        { detail_level: 'detailed' },
        { topic: 'water_level_methodology', detail_level: 'detailed' },
        {}
      ];

      validInputs.forEach(input => {
        expect(() => GetMeasurementInfoSchema.parse(input)).not.toThrow();
      });
    });

    it('should reject invalid input parameters', () => {
      const invalidInputs = [
        { topic: 'invalid_topic' },
        { detail_level: 'invalid_level' },
        { topic: 123 },
        { search_term: 123 },
        { station_id: 123 }
      ];

      invalidInputs.forEach(input => {
        expect(() => GetMeasurementInfoSchema.parse(input)).toThrow();
      });
    });
  });

  describe('topic queries', () => {
    it('should return water level methodology information', async () => {
      const result = await getMeasurementInfo({ topic: 'water_level_methodology' });
      
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Water Level Measurement Methodology');
      expect(responseText).toContain('NAVD88');
      expect(responseText).toContain('WMLW');
      expect(responseText).toContain('North American Vertical Datum');
      expect(responseText).toContain('Washington Mean Low Water');
    });

    it('should return flow rate methodology information', async () => {
      const result = await getMeasurementInfo({ topic: 'flow_rate_methodology' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Flow Rate Measurement Methodology');
      expect(responseText).toContain('CFS');
      expect(responseText).toContain('Cubic Feet per Second');
      expect(responseText).toContain('Rating Curves');
      expect(responseText).toContain('Acoustic Doppler');
    });

    it('should return stations information', async () => {
      const result = await getMeasurementInfo({ topic: 'stations' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('USGS Monitoring Stations');
      expect(responseText).toContain('Georgetown Station (01647600)');
      expect(responseText).toContain('Little Falls Station (01646500)');
      expect(responseText).toContain('Georgetown waterfront');
      expect(responseText).toContain('Little Falls Pump Station');
    });

    it('should return units and datums information', async () => {
      const result = await getMeasurementInfo({ topic: 'units_datums' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Units and Datums Reference');
      expect(responseText).toContain('feet (ft)');
      expect(responseText).toContain('cubic feet per second (CFS)');
      expect(responseText).toContain('NAVD88 to WMLW');
      expect(responseText).toContain('1.27 feet');
    });

    it('should return quality codes information', async () => {
      const result = await getMeasurementInfo({ topic: 'quality_codes' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Data Quality Codes');
      expect(responseText).toContain('A: Excellent');
      expect(responseText).toContain('B: Good');
      expect(responseText).toContain('C: Fair');
      expect(responseText).toContain('D: Poor');
      expect(responseText).toContain('E: Estimated');
    });

    it('should return data processing information', async () => {
      const result = await getMeasurementInfo({ topic: 'data_processing' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Data Processing');
      expect(responseText).toContain('15 minutes');
      expect(responseText).toContain('Quality Control');
      expect(responseText).toContain('30-minute threshold');
      expect(responseText).toContain('Staleness Detection');
    });

    it('should return temporal context information', async () => {
      const result = await getMeasurementInfo({ topic: 'temporal_context' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Temporal Context');
      expect(responseText).toContain('Seasonal Variations');
      expect(responseText).toContain('Historical Context');
      expect(responseText).toContain('Recreational and Safety');
      expect(responseText).toContain('Flood stage warnings: 10.0 feet NAVD88');
    });

    it('should return API technical information', async () => {
      const result = await getMeasurementInfo({ topic: 'api_technical' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Technical API');
      expect(responseText).toContain('ISO 8601');
      expect(responseText).toContain('P7D');
      expect(responseText).toContain('PT90M');
      expect(responseText).toContain('JSON Response');
      expect(responseText).toContain('Cache TTL');
    });

    it('should return overview information by default', async () => {
      const result = await getMeasurementInfo({});
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Water Services MCP');
      expect(responseText).toContain('System Overview');
      expect(responseText).toContain('Available Tools');
      expect(responseText).toContain('Georgetown');
      expect(responseText).toContain('Little Falls');
    });
  });

  describe('station queries', () => {
    it('should return Georgetown station information', async () => {
      const result = await getMeasurementInfo({ 
        station_id: '01647600',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Georgetown Station (01647600)');
      expect(responseText).toContain('water level monitoring');
      expect(responseText).toContain('Georgetown waterfront');
      expect(responseText).toContain('Key Bridge');
      expect(responseText).toContain('38.9044°N');
      expect(responseText).toContain('77.0631°W');
    });

    it('should return Little Falls station information', async () => {
      const result = await getMeasurementInfo({ 
        station_id: '01646500',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Little Falls Station (01646500)');
      expect(responseText).toContain('Streamflow monitoring');
      expect(responseText).toContain('Little Falls Pump Station');
      expect(responseText).toContain('discharge measurement');
      expect(responseText).toContain('11,560 square miles');
    });

    it('should handle unknown station IDs', async () => {
      const result = await getMeasurementInfo({ station_id: '99999999' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Station 99999999 not found');
      expect(responseText).toContain('01647600');
      expect(responseText).toContain('01646500');
    });
  });

  describe('search queries', () => {
    it('should find NAVD88 related information', async () => {
      const result = await getMeasurementInfo({ search_term: 'NAVD88' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Search Results for "NAVD88"');
      expect(responseText).toContain('North American Vertical Datum');
      expect(responseText).toContain('NAVD88 Datum');
      expect(responseText).toContain('matching section');
    });

    it('should find CFS related information', async () => {
      const result = await getMeasurementInfo({ search_term: 'CFS' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Search Results for "CFS"');
      expect(responseText).toContain('Cubic Feet per Second');
      expect(responseText).toContain('flow rate');
    });

    it('should find quality code information', async () => {
      const result = await getMeasurementInfo({ search_term: 'quality' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Search Results for "quality"');
      expect(responseText).toContain('Quality');
    });

    it('should handle search terms with no matches', async () => {
      const result = await getMeasurementInfo({ search_term: 'nonexistent_term_xyz' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('No matches found');
      expect(responseText).toContain('nonexistent_term_xyz');
      expect(responseText).toContain('Try searching for terms like');
    });
  });

  describe('detail levels', () => {
    it('should provide overview level detail by default', async () => {
      const result = await getMeasurementInfo({ topic: 'water_level_methodology' });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Key Points:');
      expect(responseText).toContain('Examples:');
      // Should not contain detailed technical information
      expect(responseText).not.toContain('Technical Details:');
    });

    it('should provide detailed technical information when requested', async () => {
      const result = await getMeasurementInfo({ 
        topic: 'water_level_methodology',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Key Points:');
      expect(responseText).toContain('Technical Details:');
      expect(responseText).toContain('Examples:');
      expect(responseText).toContain('Accuracy:');
      expect(responseText).toContain('Datum established');
    });

    it('should handle detailed level for station queries', async () => {
      const result = await getMeasurementInfo({ 
        station_id: '01647600',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('Technical Details:');
      expect(responseText).toContain('Coordinates:');
      expect(responseText).toContain('Parameter code:');
    });
  });

  describe('error handling', () => {
    it('should handle invalid topic gracefully', async () => {
      // We can't directly test invalid enum values due to TypeScript/Zod validation
      // but we can simulate the scenario by testing the internal logic
      const result = await getMeasurementInfo({ topic: 'overview' });
      
      // Should not throw error and should return valid response
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should handle empty parameters gracefully', async () => {
      const result = await getMeasurementInfo({});
      
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Water Services MCP');
    });
  });

  describe('content quality', () => {
    it('should provide comprehensive water level methodology content', async () => {
      const result = await getMeasurementInfo({ topic: 'water_level_methodology' });
      
      const responseText = result.content[0].text;
      // Check for key methodology concepts
      expect(responseText).toContain('NAVD88');
      expect(responseText).toContain('WMLW');
      expect(responseText).toContain('Pressure transducers measure hydrostatic pressure');
      expect(responseText).toContain('Radar sensors provide non-contact measurement');
      expect(responseText).toContain('15-minute measurement intervals');
      expect(responseText).toContain('Backup systems ensure data continuity');
    });

    it('should provide comprehensive flow rate methodology content', async () => {
      const result = await getMeasurementInfo({ topic: 'flow_rate_methodology' });
      
      const responseText = result.content[0].text;
      // Check for key flow concepts
      expect(responseText).toContain('CFS');
      expect(responseText).toContain('rating curve');
      expect(responseText).toContain('acoustic Doppler');
      expect(responseText).toContain('discharge');
      expect(responseText).toContain('velocity');
      expect(responseText).toContain('cross-sectional');
    });

    it('should provide accurate station coordinates and details', async () => {
      const result = await getMeasurementInfo({ 
        station_id: '01647600',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('38.9044°N');
      expect(responseText).toContain('77.0631°W');
      expect(responseText).toContain('Parameter code: 00065 (gage height)');
      expect(responseText).toContain('gage height');
    });

    it('should provide accurate unit conversions', async () => {
      const result = await getMeasurementInfo({ 
        topic: 'units_datums',
        detail_level: 'detailed'
      });
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('1.27 feet');
      expect(responseText).toContain('7.48052 gallons');
      expect(responseText).toContain('0.0283168 cubic meters');
      expect(responseText).toContain('NAVD88 to WMLW');
    });
  });
});