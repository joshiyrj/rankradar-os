import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../components/StatCard.jsx';

describe('StatCard', () => {
  it('renders a metric label and value', () => {
    render(<StatCard label="Tracked Keywords" value={42} hint="demo" />);
    expect(screen.getByText('Tracked Keywords')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
