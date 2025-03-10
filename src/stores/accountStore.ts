import { ref } from 'vue'
import { defineStore } from 'pinia'

export enum AccountType {
  local = 'local',
  ldap = 'ldap',
}

export interface Tag {
  text: string
}

export interface Account {
  login: string
  id: string
  tags: Tag[]
  password: string | null
  type: AccountType
}

export const useAccountStore = defineStore(
  'accountStore',
  () => {
    const accounts = ref<Account[]>([])

    // Функция для сохранения учетных записей
    function saveAccounts(newAccounts: Account[]) {
      accounts.value = newAccounts // Заменяем массив целиком
    }

    return { accounts, saveAccounts }
  },
  {
    persist: {
      storage: localStorage, // Сохраняем в localStorage
    },
  },
)
