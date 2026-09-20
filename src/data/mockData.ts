import { UserProfile } from '../types';

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
