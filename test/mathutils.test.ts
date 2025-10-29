import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MathUtils } from '../src/ecs/utils/MathUtils';

describe('MathUtils', () => {
  it('computeTriangleArea should compute correct area', () => {
    const v1 = new THREE.Vector3(0, 0, 0);
    const v2 = new THREE.Vector3(1, 0, 0);
    const v3 = new THREE.Vector3(0, 1, 0);

    const area = MathUtils.computeTriangleArea(v1, v2, v3);
    expect(area).toBeCloseTo(0.5, 6);
  });

  it('computeNormalizedDirection returns zero vector for identical points', () => {
    const a = new THREE.Vector3(1, 1, 1);
    const b = new THREE.Vector3(1, 1, 1);
    const dir = MathUtils.computeNormalizedDirection(a, b);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
    expect(dir.z).toBe(0);
  });

  it('computeNormalizedDirection returns unit vector', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0, 0, 1);
    const dir = MathUtils.computeNormalizedDirection(a, b);
    expect(dir.length()).toBeCloseTo(1, 6);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.z).toBeCloseTo(1, 6);
  });

  it('computeTriangleNormal should compute correct normal', () => {
    const v1 = new THREE.Vector3(0, 0, 0);
    const v2 = new THREE.Vector3(1, 0, 0);
    const v3 = new THREE.Vector3(0, 1, 0);

    const normal = MathUtils.computeTriangleNormal(v1, v2, v3);
    expect(normal.x).toBeCloseTo(0, 6);
    expect(normal.y).toBeCloseTo(0, 6);
    expect(normal.z).toBeCloseTo(1, 6);
  });

  it('computeTorque should compute correct torque', () => {
    const centerOfMass = new THREE.Vector3(0, 0, 0);
    const applicationPoint = new THREE.Vector3(1, 0, 0);
    const force = new THREE.Vector3(0, 1, 0);

    const torque = MathUtils.computeTorque(applicationPoint, centerOfMass, force);
    expect(torque.x).toBeCloseTo(0, 6);
    expect(torque.y).toBeCloseTo(0, 6);
    expect(torque.z).toBeCloseTo(1, 6);
  });
});
