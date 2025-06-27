/**
 * ENTERPRISE COMPONENT LIBRARY DEMO
 * Showcase of all available components
 */

import React, { useState } from 'react';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Flex,
  Stack,
  Grid,
  Spacer,
} from '../components/ui';

const ComponentDemo: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  const sampleData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive', role: 'User' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'pending', role: 'User' },
  ];

  return (
    <div className="enterprise-app">
      <Container>
        <PageHeader
          title="Enterprise Component Library"
          subtitle="Professional React components following enterprise design standards"
          actions={
            <Button variant="primary">
              View Documentation
            </Button>
          }
        />

        <Stack gap={8}>
          {/* Buttons Section */}
          <Card>
            <CardHeader title="Buttons" subtitle="Various button styles and states" />
            <CardContent>
              <Stack gap={4}>
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Button Variants</h4>
                  <Flex gap={3} wrap>
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                  </Flex>
                </div>

                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Button Sizes</h4>
                  <Flex gap={3} align="center">
                    <Button size="sm">Small</Button>
                    <Button size="base">Base</Button>
                    <Button size="lg">Large</Button>
                  </Flex>
                </div>

                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Button States</h4>
                  <Flex gap={3}>
                    <Button loading>Loading</Button>
                    <Button disabled>Disabled</Button>
                    <Button leftIcon="📊">With Icon</Button>
                  </Flex>
                </div>
              </Stack>
            </CardContent>
          </Card>

          {/* Form Components */}
          <Card>
            <CardHeader title="Form Components" subtitle="Input fields and form controls" />
            <CardContent>
              <Grid cols={2} gap={6}>
                <Stack gap={4}>
                  <Input
                    label="Text Input"
                    placeholder="Enter some text..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    helperText="This is helper text"
                  />
                  
                  <Input
                    label="Email Input"
                    type="email"
                    placeholder="user@example.com"
                    state="success"
                    helperText="Valid email format"
                  />
                  
                  <Input
                    label="Error State"
                    placeholder="Invalid input"
                    error="This field is required"
                  />
                </Stack>

                <Stack gap={4}>
                  <Select
                    label="Select Option"
                    value={selectValue}
                    onChange={(e) => setSelectValue(e.target.value)}
                    options={[
                      { value: '', label: 'Choose an option...' },
                      { value: 'option1', label: 'Option 1' },
                      { value: 'option2', label: 'Option 2' },
                      { value: 'option3', label: 'Option 3' },
                    ]}
                    helperText="Select from available options"
                  />
                  
                  <Input
                    label="Disabled Input"
                    placeholder="Cannot edit this"
                    disabled
                  />
                  
                  <Input
                    label="With Icons"
                    placeholder="Search..."
                    leftIcon="🔍"
                    rightIcon="⚙️"
                  />
                </Stack>
              </Grid>
            </CardContent>
          </Card>

          {/* Badges Section */}
          <Card>
            <CardHeader title="Badges & Status" subtitle="Status indicators and labels" />
            <CardContent>
              <Stack gap={4}>
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Badge Variants</h4>
                  <Flex gap={3} wrap>
                    <Badge variant="default">Default</Badge>
                    <Badge variant="primary">Primary</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="error">Error</Badge>
                    <Badge variant="warning">Warning</Badge>
                    <Badge variant="info">Info</Badge>
                  </Flex>
                </div>

                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Badge Sizes</h4>
                  <Flex gap={3} wrap>
                    <Badge variant="primary" size="sm">Small</Badge>
                    <Badge variant="primary" size="base">Base</Badge>
                    <Badge variant="primary" size="lg">Large</Badge>
                  </Flex>
                </div>

                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Status Badges</h4>
                  <Flex gap={3} wrap>
                    <StatusBadge status="active" />
                    <StatusBadge status="inactive" />
                    <StatusBadge status="pending" />
                    <StatusBadge status="executed" />
                    <StatusBadge status="error" />
                    <StatusBadge status="rejected" />
                  </Flex>
                </div>
              </Stack>
            </CardContent>
          </Card>

          {/* Table Section */}
          <Card>
            <CardHeader title="Data Table" subtitle="Enterprise data table with sorting and hover effects" />
            <CardContent>
              <Table hoverable>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell sortable sortDirection="asc">Name</TableHeaderCell>
                    <TableHeaderCell sortable>Email</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleData.map((row) => (
                    <TableRow key={row.id} clickable>
                      <TableCell style={{ fontWeight: '600' }}>{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status as any} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.role === 'Admin' ? 'primary' : 'default'} size="sm">
                          {row.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Flex gap={2}>
                          <Button size="sm" variant="ghost">Edit</Button>
                          <Button size="sm" variant="ghost">Delete</Button>
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards Section */}
          <Grid cols={3} gap={6}>
            <Card variant="default" hoverable>
              <CardHeader title="Default Card" />
              <CardContent>
                <p>This is a default card with hover effects.</p>
                <Spacer size={4} />
                <Button variant="outline" fullWidth>Action</Button>
              </CardContent>
            </Card>

            <Card variant="outlined" clickable>
              <CardHeader title="Outlined Card" />
              <CardContent>
                <p>This is an outlined card that's clickable.</p>
                <Spacer size={4} />
                <Button variant="primary" fullWidth>Primary Action</Button>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader title="Elevated Card" />
              <CardContent>
                <p>This is an elevated card with shadow.</p>
                <Spacer size={4} />
                <Button variant="secondary" fullWidth>Secondary Action</Button>
              </CardContent>
            </Card>
          </Grid>

          <Spacer size={8} />
        </Stack>
      </Container>
    </div>
  );
};

export default ComponentDemo;
