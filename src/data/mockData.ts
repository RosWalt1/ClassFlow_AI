import { ProjectItem, UMLClassNode, UMLRelation, UserProfile } from '../types';

export const ASSETS = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAk8X_ExQn6PI-auFy6UB_XQDzouZCek_T-XHHckEZNKOzK20OczBLRd2rCaIZqXgHjVpPsy1FgX1w4v5jrjZJFWhuzg4tt8gCLSjosjghXsNqEX_iapBrfkdXNFRSG_OgsE9vV7mShsDQyiz2oOWXygiYtcomDmT9YSFgi8JdPHNmlNOu1vjsFelnDKMiHOx29i9w-6IKHr1iab-ztZzJ5bBncM91-h7KCfxGhyL_ti5kgC6PwPOda9Q',
  carlosMendoza: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDawfmyLLP-X8i_WFxxulN0wsMvIOLM02ZWTlW8e49YIdCH2JrNP3HSL8rod-VhEZcdsBVFN9cyYK2yCQqqzCeSm0FbtQbNnXJ_DtBNmpnJKvRzAaA5dPdnJJEuNdyk6Cpon-55YqalQS32MSuSjyrh1DRqK5kGK8NUkqvNpds6aol_5yhOLFjh4VQeoZX_z3Swm9ZOdiKM_vKAhaukoCms-40o-fNNLdgS9ogHnvyKgyunkg4NST_PzA',
  carlosMendozaAlt: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBerjsJZjq0_dVfXNVTF5bVjMdyQXKs1k09AobZKZpiMNpBT67-GAvq9HDH96IFtdoequ87134DF14c9xAnbyou01RfXUMjm4qB0K1A3MQiGDnZlG7qZIgnArzO3y53XvuyivH07zamxw-mdm4WxDWHlmIg31TaZtGdlGmWh8r9ryUXXCH6QZeySvmRacFfE4oxiqRS3gGUpwaaSygZslmd6BfKH5w63Y6y3S6Hypdh5beCWxAVymjyOw',
  anaLopez: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPJAvrDxRSLYOovYSsY-rpFIaZVojpZb60uYo1ANyjuVaQ8wWDfHEIiX5lrp4FsLixgRFJ-ksDPnmuweKOIkjfTW81mm3YfgoY6ohNuV4XzsqwzI97c1QZUuXwG_OB1RW8eMKgNeJV2CrMIgbMdstHKtNB13QPnUty289fDpTTcLsjcEygG2CfmFq0-M3x9AzJY7VTg-AKkkCYI0xyRmBdjnNQWItulzER3K4oOOf6qasqlrOGeQr9vA',
  anaLopezAlt: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBWcGP_sXr4DsONmRhCehNGlEIjmrv6ImTjEbbcrM3nxUFX7G9O8iwVEzCh13i45ZyftGQ0RplJ4QWlSzl8D3Zl8a7vyl6lEm7TqEiV3P6x3WsTZzNspjzhA_xZgPyu_sxCTGl9mfbTBcOqwNITnZic5voyyySsaVTXMHrxbTG1NE8diDm_sswLqGnK_kq2NTEJY5grIeALE798D9vCQ6xQCiMnRyxXX6cfD2V84_WqF3XCOVCXKCq2cA',
  davidChen: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfICAdoxZLqywuQgn2MDhcaRFsvFwER_rNzl0Xv2WZQh0NnyMneanpfsS6IaZSKajcxyrbWsN3deOI56rHR7nwPIB7WdVtBT1CW0HbW5yAN7qZ1m4DHJzYMmJILvUIcmX-C_lRyoWXdzqmVs1FAbk0oz6G4F9uv3Ol6QMfbc7r0JG3AsaUDXZXXhi3HAf4y8xMBW-wgCZZe2JBU5Bv9fndLosxm6yM51S-lqauCd0If27z1vYpplKZQ',
  elenaRuiz: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDa5vxXB08xzqGrbP9VpRC7JDyos-pbeTMGhx-BCi1h_lUx5WwAqyxCCmyBU9SldHmiMt60ya1oHh8INTUc_-cl3ZlIQtSZs9D1Xl3oYfNulmKXbTFi1V34r8DuIdJ5yttfPMDivlNYoNRbIwH0AgEBdLQM7vtrMzyqlLf0OlS4NEu5D2MP7wxqsPt0IuVC_ibhC7QR3oOwE5s_aoUpuLOrg4fOjKPFWlizKrWAwb5iZ7wqzl0dcQ_pGA',
};

export const INITIAL_USERS: Record<string, UserProfile> = {
  carlos: {
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@classflow.ai',
    role: 'Propietario',
    avatar: ASSETS.carlosMendoza,
    permissionsBadge: 'RWX Full Propietario',
  },
  ana: {
    name: 'Ana López',
    email: 'ana.lopez@devteam.io',
    role: 'Invitado',
    avatar: ASSETS.anaLopez,
    permissionsBadge: 'R-X ReadOnly Invitado',
  },
};

export const MOCK_USERS = INITIAL_USERS;

export const INITIAL_CLASSES: UMLClassNode[] = [
  {
    id: 'cliente',
    name: 'Cliente',
    stereotype: '«entity»',
    x: 96,
    y: 96,
    width: 240,
    isConcrete: true,
    attributes: [
      { id: 'c1', visibility: '-', name: 'id', type: 'Long', isPk: true },
      { id: 'c2', visibility: '-', name: 'nombre', type: 'String' },
      { id: 'c3', visibility: '-', name: 'correo', type: 'String' },
    ],
    methods: [
      { id: 'cm1', visibility: '+', name: 'actualizarDatos', returnType: 'void' },
    ],
  },
  {
    id: 'venta',
    name: 'Venta',
    stereotype: '«entity»',
    x: 520,
    y: 80,
    width: 256,
    isConcrete: true,
    attributes: [
      { id: 'v1', visibility: '-', name: 'id', type: 'Long', isPk: true },
      { id: 'v2', visibility: '-', name: 'fecha', type: 'LocalDateTime' },
      { id: 'v3', visibility: '-', name: 'total', type: 'BigDecimal' },
    ],
    methods: [
      { id: 'vm1', visibility: '+', name: 'calcularTotal', returnType: 'BigDecimal' },
    ],
  },
  {
    id: 'producto',
    name: 'Producto',
    stereotype: '«entity»',
    x: 300,
    y: 410,
    width: 288,
    isConcrete: true,
    attributes: [
      { id: 'p1', visibility: '-', name: 'id', type: 'Long', isPk: true },
      { id: 'p2', visibility: '-', name: 'nombre', type: 'String' },
      { id: 'p3', visibility: '-', name: 'precio', type: 'BigDecimal', isNullable: false, isStatic: false, isFinal: false },
    ],
    methods: [
      { id: 'pm1', visibility: '+', name: 'actualizarPrecio', returnType: 'void' },
    ],
  },
];

export const INITIAL_RELATIONS: UMLRelation[] = [
  {
    id: 'rel_cliente_venta',
    sourceId: 'cliente',
    targetId: 'venta',
    type: 'association',
    sourceMultiplicity: '1',
    targetMultiplicity: '0..*',
    roleName: 'compras',
  },
  {
    id: 'rel_venta_producto',
    sourceId: 'venta',
    targetId: 'producto',
    type: 'composition',
    sourceMultiplicity: '0..*',
    targetMultiplicity: '0..*',
    roleName: 'detalle',
  },
];

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'sistema-ventas',
    name: 'Sistema de Ventas',
    description: 'Diagrama de clases principal para la plataforma de pedidos, facturación y gestión de stock sincronizado con endpoints REST.',
    isOwner: true,
    role: 'Propietario',
    stackBadge: 'PostgreSQL + Spring Boot',
    classesCount: 3,
    relationsCount: 2,
    version: 'v2.1',
    modifiedAgo: 'Hace 5 min',
    schemaPreview: {
      left: 'Order.java',
      arrow: '→',
      right: 'Invoice.java',
      tag: 'v2.1',
    },
    collaborators: [
      { name: 'Carlos Mendoza', avatar: ASSETS.carlosMendoza, role: 'Owner' },
      { name: 'Ana López', avatar: ASSETS.anaLopez, role: 'Dev' },
    ],
  },
  {
    id: 'auth-rbac',
    name: 'Core Auth & RBAC Microservice',
    description: 'Modelo de clases UML para autenticación JWT, usuarios, roles, permisos y sesiones activas con control granular.',
    isOwner: true,
    role: 'Propietario',
    stackBadge: 'Node.js + Prisma',
    classesCount: 8,
    relationsCount: 6,
    version: 'v1.4',
    modifiedAgo: 'Ayer a las 18:30',
    schemaPreview: {
      left: 'User',
      arrow: '◇—',
      right: 'Role —* Permission',
      tag: 'RBAC 2.0',
    },
    collaborators: [
      { name: 'Carlos Mendoza', avatar: ASSETS.carlosMendoza, role: 'Owner' },
    ],
  },
  {
    id: 'logistics',
    name: 'Logistics & Supply Chain',
    description: 'Diagrama de clases para rutas de entrega, almacenes y transportistas con trazabilidad de paquetes e inventarios.',
    isOwner: false,
    role: 'Invitado',
    stackBadge: 'Go + gRPC',
    classesCount: 12,
    relationsCount: 9,
    version: 'v3.0',
    modifiedAgo: 'Hace 3 días',
    schemaPreview: {
      left: 'Fleet',
      arrow: '—1..*—',
      right: 'Warehouse —* Shipment',
      tag: 'Multi-tenant',
    },
    collaborators: [
      { name: 'Elena Ruiz', avatar: ASSETS.elenaRuiz, role: 'Owner' },
      { name: 'David Chen', avatar: ASSETS.davidChen, role: 'Dev' },
      { name: 'Carlos Mendoza', avatar: ASSETS.carlosMendoza, role: 'Collab' },
    ],
  },
];

export const SPRING_BOOT_FILES: Record<string, string> = {
  'Cliente.java': `// Generated deterministically by ClassFlow AI (CU10 - AST Target: Spring JPA)
package com.app.ventas.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "cliente")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "nombre", nullable = false, length = 120)
    private String nombre;

    @Column(name = "email", unique = true, length = 150)
    private String email;

    // Relación UML 1:N generada a partir del diagrama con Venta
    @OneToMany(mappedBy = "cliente", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Venta> ventas = new ArrayList<>();

    // Método de dominio especificado en UML
    public void registrarHistorialVenta(Venta venta) {
        this.ventas.add(venta);
        venta.setCliente(this);
    }
}`,

  'Venta.java': `// Generated deterministically by ClassFlow AI (CU10 - AST Target: Spring JPA)
package com.app.ventas.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "venta")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Venta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "fecha", nullable = false)
    @Builder.Default
    private LocalDateTime fecha = LocalDateTime.now();

    @NotNull
    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToMany
    @JoinTable(
        name = "venta_producto",
        joinColumns = @JoinColumn(name = "venta_id"),
        inverseJoinColumns = @JoinColumn(name = "producto_id")
    )
    @Builder.Default
    private List<Producto> productos = new ArrayList<>();

    public BigDecimal calcularTotal() {
        return productos.stream()
            .map(Producto::getPrecio)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}`,

  'Producto.java': `// Generated deterministically by ClassFlow AI (CU10 - AST Target: Spring JPA)
package com.app.ventas.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "producto")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @NotNull
    @Column(name = "precio", nullable = false, precision = 10, scale = 2)
    private BigDecimal precio;

    public void actualizarPrecio(BigDecimal nuevoPrecio) {
        if (nuevoPrecio != null && nuevoPrecio.compareTo(BigDecimal.ZERO) >= 0) {
            this.precio = nuevoPrecio;
        }
    }
}`,

  'ClienteRepository.java': `package com.app.ventas.repository;

import com.app.ventas.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    Optional<Cliente> findByEmail(String email);
}`,

  'VentaRepository.java': `package com.app.ventas.repository;

import com.app.ventas.model.Venta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VentaRepository extends JpaRepository<Venta, Long> {
    List<Venta> findByClienteId(Long clienteId);
}`,

  'ClienteService.java': `package com.app.ventas.service;

import com.app.ventas.model.Cliente;
import com.app.ventas.repository.ClienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional
public class ClienteService {
    private final ClienteRepository repository;

    public ClienteService(ClienteRepository repository) {
        this.repository = repository;
    }

    public List<Cliente> findAll() {
        return repository.findAll();
    }

    public Cliente save(Cliente cliente) {
        return repository.save(cliente);
    }
}`,

  'VentaService.java': `package com.app.ventas.service;

import com.app.ventas.model.Venta;
import com.app.ventas.repository.VentaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional
public class VentaService {
    private final VentaRepository repository;

    public VentaService(VentaRepository repository) {
        this.repository = repository;
    }

    public List<Venta> findByClienteId(Long clienteId) {
        return repository.findByClienteId(clienteId);
    }

    public Venta procesarVenta(Venta venta) {
        venta.setTotal(venta.calcularTotal());
        return repository.save(venta);
    }
}`,

  'ClienteController.java': `package com.app.ventas.controller;

import com.app.ventas.model.Cliente;
import com.app.ventas.service.ClienteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/clientes")
public class ClienteController {
    private final ClienteService service;

    public ClienteController(ClienteService service) {
        this.service = service;
    }

    @GetMapping
    public List<Cliente> findAll() {
        return service.findAll();
    }

    @PostMapping
    public ResponseEntity<Cliente> save(@Valid @RequestBody Cliente cliente) {
        return ResponseEntity.ok(service.save(cliente));
    }
}`,

  'V1__init_schema.sql': `-- ClassFlow AI Deterministic AST DDL Postgres
CREATE TABLE cliente (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE
);

CREATE TABLE venta (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    total NUMERIC(12, 2) NOT NULL,
    cliente_id BIGINT REFERENCES cliente(id) ON DELETE CASCADE
);

CREATE TABLE producto (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10, 2) NOT NULL
);

CREATE TABLE venta_producto (
    venta_id BIGINT REFERENCES venta(id) ON DELETE CASCADE,
    producto_id BIGINT REFERENCES producto(id) ON DELETE CASCADE,
    PRIMARY KEY (venta_id, producto_id)
);

CREATE INDEX idx_venta_cliente ON venta(cliente_id);`,

  'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/ventasdb
      - SPRING_DATASOURCE_USERNAME=postgres
      - SPRING_DATASOURCE_PASSWORD=secret
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    restart: always
    environment:
      - POSTGRES_DB=ventasdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`,
};

export const NESTJS_FILES: Record<string, string> = {
  'cliente.entity.ts': `import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Venta } from './venta.entity';

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 150, unique: true })
  email: string;

  @OneToMany(() => Venta, (venta) => venta.cliente, { cascade: true })
  ventas: Venta[];
}`,

  'venta.entity.ts': `import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { Cliente } from './cliente.entity';
import { Producto } from './producto.entity';

@Entity('venta')
export class Venta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @ManyToOne(() => Cliente, (cliente) => cliente.ventas)
  cliente: Cliente;

  @ManyToMany(() => Producto)
  @JoinTable()
  productos: Producto[];
}`,

  'schema.prisma': `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Cliente {
  id     Int     @id @default(autoincrement())
  nombre String  @db.VarChar(120)
  email  String  @unique @db.VarChar(150)
  ventas Venta[]
}

model Venta {
  id        Int        @id @default(autoincrement())
  fecha     DateTime   @default(now())
  total     Decimal    @db.Decimal(12, 2)
  clienteId Int
  cliente   Cliente    @relation(fields: [clienteId], references: [id])
  productos Producto[]
}

model Producto {
  id     Int     @id @default(autoincrement())
  nombre String  @db.VarChar(100)
  precio Decimal @db.Decimal(10, 2)
  ventas Venta[]
}`,
};
